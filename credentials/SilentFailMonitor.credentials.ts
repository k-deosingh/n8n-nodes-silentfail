import type { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * A monitor's ping URL, stored as a credential.
 *
 * Silent Fail has no API key and no OAuth. The only secret it has is the
 * unguessable token in a monitor's ping URL, and this credential holds exactly
 * that and nothing else. Inventing an "API key" field to look conventional would
 * be describing a product that does not exist.
 *
 * It is worth having as a credential rather than a plain node field for one
 * concrete reason: n8n encrypts credentials at rest and leaves them out of an
 * exported workflow, whereas a value typed into a node field travels inside the
 * workflow JSON. That token is the whole of the authentication, so a workflow
 * shared in a forum post or committed to a repository would hand it over.
 *
 * Using it is optional. The node also accepts a URL directly, because somebody
 * wiring up their first monitor should not have to learn about credentials to
 * see it work.
 */
export class SilentFailMonitor implements ICredentialType {
	name = 'silentFailMonitor';

	displayName = 'Silent Fail Monitor';

	documentationUrl = 'https://silentfailapp.com/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'Ping URL',
			name: 'pingUrl',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'https://silentfailapp.com/api/ping/your-monitor-token',
			required: true,
			description:
				'The full ping URL for one monitor, copied from its page in Silent Fail. This is the only secret the product uses, so treat it like a password. Anyone who has it can mark this monitor as alive.',
		},
	];
}
