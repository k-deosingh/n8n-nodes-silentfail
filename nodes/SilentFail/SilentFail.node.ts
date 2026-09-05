import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

/**
 * The Silent Fail node.
 *
 * One resource, the monitor, because a monitor is the only thing Silent Fail
 * has. Two operations, because the product has exactly two endpoints: one that
 * records a ping and one that reads a monitor without recording anything.
 * Anything beyond those would be describing an API that does not exist.
 *
 * The usual place for this node is the last step of a workflow. If the workflow
 * stops running the pings stop arriving, and Silent Fail emails you. The point
 * is that it detects absence, which is the failure an error handler cannot
 * catch: a workflow that never starts produces no error to handle.
 */
export class SilentFail implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Silent Fail',
		name: 'silentFail',
		icon: { light: 'file:silentFail.svg', dark: 'file:silentFail.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Tell Silent Fail this workflow finished, so you get an email when it stops',
		defaults: {
			name: 'Silent Fail',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'silentFailMonitorApi',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Monitor',
						value: 'monitor',
					},
				],
				default: 'monitor',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['monitor'],
					},
				},
				options: [
					{
						name: 'Ping',
						value: 'ping',
						description:
							'Tell Silent Fail the workflow got this far. Put this at the end of a workflow: if the pings stop arriving, Silent Fail emails you.',
						action: 'Ping a monitor',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						description:
							'Read whether the monitor exists and is being watched, without recording a ping or changing its status',
						action: 'Get a monitor status',
					},
				],
				default: 'ping',
			},
			{
				displayName: 'Monitor Source',
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
				displayOptions: {
					show: {
						resource: ['monitor'],
						operation: ['ping'],
					},
				},
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
				],
				default: 'GET',
				description:
					'Either works and Silent Fail treats them the same. GET is the simpler default. Use POST if something between you and us blocks or caches GET requests.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Ignore Failures',
						name: 'ignoreFailure',
						type: 'boolean',
						default: false,
						description:
							'Whether to let the workflow succeed even if Silent Fail could not be reached. Turn this on if the work this workflow does matters more than the monitoring of it. Leaving it off means a failed request fails the run, which is louder but tells you the monitoring is broken.',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 10000,
						description:
							'How many milliseconds to wait for a reply before giving up. The endpoint answers in well under a second, so this only matters on a bad connection.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;
			const monitorSource = this.getNodeParameter('monitorSource', i) as string;
			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const timeout = (options.timeout as number) ?? 10000;
			const ignoreFailure = (options.ignoreFailure as boolean) ?? false;
			const usingCredential = monitorSource === 'credential';

			if (resource !== 'monitor') {
				throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
					itemIndex: i,
				});
			}

			if (operation !== 'ping' && operation !== 'getStatus') {
				throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
					itemIndex: i,
				});
			}

			// Get Status reads the monitor and records nothing, so it is always a
			// GET and the /check path is what keeps it free of consequences. Ping is
			// the only operation where the method is the user's to choose.
			const isPing = operation === 'ping';
			const method = (isPing ? this.getNodeParameter('method', i) : 'GET') as IHttpRequestMethods;
			const path = isPing ? '' : '/check';

			let pingUrl = '';
			if (!usingCredential) {
				pingUrl = (this.getNodeParameter('pingUrl', i) as string).trim();

				if (!pingUrl) {
					throw new NodeOperationError(
						this.getNode(),
						'No ping URL. Open your monitor in Silent Fail, copy its ping URL, and paste it here.',
						{ itemIndex: i },
					);
				}

				// Checked here rather than left to the request, because a typo in
				// the URL otherwise surfaces as a confusing network error later.
				if (!/^https?:\/\//i.test(pingUrl)) {
					throw new NodeOperationError(
						this.getNode(),
						`That does not look like a ping URL: "${pingUrl}". It should start with https:// and end with your monitor token.`,
						{ itemIndex: i },
					);
				}
			}

			const requestOptions = {
				method,
				// Just the path when a credential is in use. The credential's
				// authenticate step prepends the URL, which is why this node never
				// reads the credential itself and can therefore use
				// httpRequestWithAuthentication.
				url: usingCredential ? path : `${pingUrl.replace(/\/+$/, '')}${path}`,
				timeout,
				json: true,
				// The ping carries no payload. Silent Fail records that the request
				// arrived and when, and never reads a body, so sending one would
				// imply it is inspected.
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			};

			// continueOnFail is the n8n-wide convention; ignoreFailure is the
			// node-level opt out for people who would rather the run succeed than
			// hear that the monitoring of it is broken.
			const swallowFailures = ignoreFailure || this.continueOnFail();

			let response;
			try {
				response = usingCredential
					? await this.helpers.httpRequestWithAuthentication.call(
							this,
							'silentFailMonitorApi',
							requestOptions,
						)
					: await this.helpers.httpRequest(requestOptions);
			} catch (error) {
				// Only transport failures reach here, since a bad status is handled
				// below rather than thrown. Nothing raw is ever rethrown.
				const message = error instanceof Error ? error.message : String(error);

				if (swallowFailures) {
					returnData.push({
						json: isPing ? { pinged: false, error: message } : { error: message },
						pairedItem: { item: i },
					});
					continue;
				}

				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}

			const status = response.statusCode as number;

			if (status < 200 || status >= 300) {
				const message =
					status === 404
						? 'Silent Fail does not recognise that monitor. The URL may be wrong, or the monitor may have been deleted. Copy the ping URL from the monitor page again.'
						: `Silent Fail rejected the request with status ${status}`;

				if (swallowFailures) {
					returnData.push({
						json: isPing ? { pinged: false, error: message } : { error: message },
						pairedItem: { item: i },
					});
					continue;
				}

				// A 404 is the user's URL being wrong, which is worth saying plainly
				// rather than dressing up as an API failure.
				if (status === 404) {
					throw new NodeOperationError(this.getNode(), message, { itemIndex: i });
				}

				throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
					message,
					itemIndex: i,
				});
			}

			const body = (response.body ?? {}) as IDataObject;

			if (isPing) {
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
				continue;
			}

			returnData.push({
				json: {
					monitor: body.monitor ?? null,
					// A disabled monitor still accepts pings, so "the URL works" and
					// "you would be told if it stopped" are different questions.
					watching: body.watching === true,
				},
				pairedItem: { item: i },
			});
		}

		return [returnData];
	}
}
