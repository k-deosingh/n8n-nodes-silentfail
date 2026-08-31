import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/**
 * The Silent Fail node. One operation, on purpose.
 *
 * All it does is make one HTTP request to a monitor's ping URL. That is the
 * entire integration surface of the product, and a node with more operations
 * would be describing an API that does not exist.
 *
 * Put it as the last step of a workflow. If the workflow stops running, the ping
 * stops arriving, and Silent Fail emails you. The point is that it detects
 * absence, which is the failure an error handler cannot catch: a workflow that
 * never starts produces no error to handle.
 */
export class SilentFail implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Silent Fail',
		name: 'silentFail',
		icon: 'file:silentFail.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["method"]}} ping',
		description: 'Tell Silent Fail this workflow finished, so you get an email when it stops',
		defaults: {
			name: 'Silent Fail',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'silentFailMonitor',
				// Optional so a first-time user can paste a URL and see it work
				// without learning the credentials system first.
				required: false,
				displayOptions: {
					show: {
						monitorSource: ['credential'],
					},
				},
			},
		],
		properties: [
			{
				displayName:
					'Add this node as the last step of your workflow. Every time the workflow finishes it pings Silent Fail, and if the pings stop arriving you get an email. This catches the failure an error handler cannot: a workflow that stops running produces no error, so nothing tells you it stopped.',
				name: 'explanation',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Monitor',
				name: 'monitorSource',
				type: 'options',
				options: [
					{
						name: 'Ping URL',
						value: 'url',
						description: 'Paste the full ping URL from the monitor page',
					},
					{
						name: 'Credential',
						value: 'credential',
						description:
							'Use a saved Silent Fail Monitor credential, which keeps the URL out of the exported workflow',
					},
				],
				default: 'url',
				description: 'Where to read this monitor ping URL from',
			},
			{
				displayName: 'Ping URL',
				name: 'pingUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://silentfailapp.com/api/ping/your-monitor-token',
				displayOptions: {
					show: {
						monitorSource: ['url'],
					},
				},
				description:
					'The full ping URL for this monitor, copied from its page in Silent Fail. It contains an unguessable token, so treat it as a secret. If you plan to share or export this workflow, use a credential instead.',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
				],
				default: 'GET',
				description:
					'Either works and Silent Fail treats them the same. GET is the simpler default. Use POST if something between you and us blocks or caches GET requests',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 10000,
						description:
							'How long to wait for the ping to be accepted before giving up. The endpoint answers in well under a second, so this only matters on a bad connection',
					},
					{
						displayName: 'Ignore Ping Failures',
						name: 'ignoreFailure',
						type: 'boolean',
						default: false,
						description:
							'Whether to let the workflow succeed even if the ping could not be delivered. Turn this on if the work this workflow does matters more than the monitoring of it. Leaving it off means a failed ping fails the run, which is louder but tells you the monitoring is broken',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const monitorSource = this.getNodeParameter('monitorSource', i) as string;
			const method = this.getNodeParameter('method', i) as 'GET' | 'POST';
			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const timeout = (options.timeout as number) ?? 10000;
			const ignoreFailure = (options.ignoreFailure as boolean) ?? false;

			let pingUrl: string;
			if (monitorSource === 'credential') {
				const credentials = await this.getCredentials('silentFailMonitor');
				pingUrl = ((credentials?.pingUrl as string) ?? '').trim();
			} else {
				pingUrl = (this.getNodeParameter('pingUrl', i) as string).trim();
			}

			if (!pingUrl) {
				throw new NodeOperationError(
					this.getNode(),
					'No ping URL. Open your monitor in Silent Fail, copy its ping URL, and paste it here.',
					{ itemIndex: i },
				);
			}

			// Checked here rather than left to the request, because a typo in the
			// URL otherwise surfaces as a confusing network error much later.
			if (!/^https?:\/\//i.test(pingUrl)) {
				throw new NodeOperationError(
					this.getNode(),
					`That does not look like a ping URL: "${pingUrl}". It should start with https:// and end with your monitor token.`,
					{ itemIndex: i },
				);
			}

			try {
				const response = await this.helpers.httpRequest({
					method,
					url: pingUrl,
					timeout,
					json: true,
					// The ping carries no payload. Silent Fail records that the
					// request arrived and when, and never reads a body, so sending
					// one would imply it is inspected.
					returnFullResponse: true,
					ignoreHttpStatusErrors: true,
				});

				const status = response.statusCode;

				if (status === 404) {
					throw new NodeOperationError(
						this.getNode(),
						'Silent Fail does not recognise that monitor. The URL may be wrong, or the monitor may have been deleted. Copy the ping URL from the monitor page again.',
						{ itemIndex: i },
					);
				}

				if (status < 200 || status >= 300) {
					throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
						message: `Silent Fail rejected the ping with status ${status}`,
						itemIndex: i,
					});
				}

				const body = (response.body ?? {}) as IDataObject;
				returnData.push({
					json: {
						pinged: true,
						monitor: body.monitor ?? null,
						status: body.status ?? null,
						receivedAt: body.receivedAt ?? null,
						// Present when this ping closed an outage, so a workflow can
						// react to its own recovery if it wants to.
						recovered: body.recovered === true,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				// continueOnFail is the n8n-wide convention; ignoreFailure is the
				// node-level opt out for people who would rather the run succeed.
				if (ignoreFailure || this.continueOnFail()) {
					returnData.push({
						json: {
							pinged: false,
							error: error instanceof Error ? error.message : String(error),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
