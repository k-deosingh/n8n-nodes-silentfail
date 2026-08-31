import type {
	IAuthenticate,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

/**
 * A monitor's ping URL, stored as a credential.
 *
 * Silent Fail has no API key and no OAuth. The only secret it has is the
 * unguessable token inside a monitor's ping URL, and this credential holds
 * exactly that and nothing else. Adding an API Key field to look conventional
 * would be describing a product that does not exist.
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
export class SilentFailMonitorApi implements ICredentialType {
	name = 'silentFailMonitorApi';

	displayName = 'Silent Fail Monitor API';

	documentationUrl = 'https://silentfailapp.com/n8n';

	icon: Icon = { light: 'file:silentFail.svg', dark: 'file:silentFail.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'Ping URL',
			name: 'pingUrl',
			type: 'string',
			// The linter warns that a field called "pingUrl" does not look
			// sensitive. Here it is: this URL is the entire authentication for one
			// monitor, and anyone holding it can report that monitor as alive.
			typeOptions: { password: true },
			default: '',
			placeholder: 'https://silentfailapp.com/api/ping/your-monitor-token',
			required: true,
			description:
				'The full ping URL for one monitor, copied from its page in Silent Fail. This is the only secret the product uses, so treat it like a password. Anyone who has it can mark this monitor as alive.',
		},
	];

	/**
	 * Composes the credential's URL with whatever path the caller asked for.
	 *
	 * The ping URL is a whole URL rather than a host, so there is no baseURL to
	 * set and no header to add. Doing it here rather than in the node means the
	 * node never reads the credential itself, which is what lets it use
	 * httpRequestWithAuthentication.
	 *
	 * The suffix is what makes the credential test possible: a ping passes an
	 * empty path and lands on the ping URL, while the test passes /check and
	 * lands on the endpoint that verifies a monitor without recording anything.
	 */
	authenticate: IAuthenticate = async (credentials, requestOptions) => {
		const base = String(credentials.pingUrl ?? '')
			.trim()
			.replace(/\/+$/, '');
		const suffix = requestOptions.url ?? '';

		return { ...requestOptions, url: `${base}${suffix}` };
	};

	/**
	 * Deliberately hits /check rather than the ping URL itself.
	 *
	 * n8n offers to test a credential when you save it, and a test that pinged
	 * the monitor would tell Silent Fail the job had run. A monitor whose
	 * workflow is dead would then be marked alive by the act of looking at it,
	 * which is the exact failure this product exists to catch. /check reads and
	 * returns a status code, and records nothing.
	 */
	test: ICredentialTestRequest = {
		request: {
			url: '/check',
			method: 'GET',
		},
	};
}
