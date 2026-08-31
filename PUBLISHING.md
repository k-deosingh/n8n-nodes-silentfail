# Publishing and submitting this package

Nothing here has been published. The name `n8n-nodes-silentfail` is unclaimed on
npm as far as this repository is concerned, and no release has been cut. The steps
below are the ones only you can do, because they need accounts.

## Why it has to go out through GitHub Actions

n8n's verification rules say that from 1 May 2026, a node submitted for
verification must be published using GitHub Actions with a provenance statement.
Provenance is a signed claim that the tarball on npm was built from a specific
commit in a specific repository, and npm generates it from the identity token
that Actions hands the job. That is why `.github/workflows/publish.yml` exists
and why publishing from a laptop is not an option any more.

It also means the repository has to be public. An attestation that points at a
repository nobody can read proves nothing, so npm will not display it.

That is the only reason this needs to be open source. The node itself is about
sixty lines of HTTP request, and the app it talks to stays private.

## What you need to do

1. **npm account.** Create one for contact@silentfailapp.com and turn on
   two factor authentication. Then create a **granular access token** with
   publish permission. Use an automation token, because a classic token with 2FA
   enforced will prompt for a one time code and the CI job has nobody to ask.

2. **Public GitHub repository.** Create `k-deosingh/n8n-nodes-silentfail` and
   make it public. If you name it anything else, change `repository.url` in
   `package.json` to match. A mismatch is not cosmetic: provenance ties the
   package to that URL, and the publish step fails outright if it disagrees.

3. **Copy this directory into it.** Everything here, including
   `package-lock.json`, because the workflow runs `npm ci` and that needs the
   lockfile. `dist` stays out, the workflow builds it.

4. **Add the token as a repository secret** named `NPM_TOKEN`, under Settings,
   Secrets and variables, Actions.

5. **Cut a release.** The workflow runs on a published GitHub release, and can
   also be triggered by hand from the Actions tab. It typechecks, builds, asserts
   the three files `package.json` promises actually exist, then runs
   `npm publish --provenance --access public`.

6. **Check it landed.** `npm view n8n-nodes-silentfail` should show version
   0.1.0, and the package page on npm should show a provenance section naming the
   commit it was built from. If provenance is missing, the `id-token: write`
   permission was dropped somewhere.

7. **Submit for verification.** Sign in at creators.n8n.io and submit the node
   there. The same portal is where workflow templates are shared, so the template
   goes in at the same time.

   Two things their guidelines ask for that are worth knowing before you submit:
   they want no runtime dependencies, which this package satisfies because
   `n8n-workflow` is only a peer and dev dependency and there is no `dependencies`
   block at all; and they strongly suggest scaffolding with their `n8n-node` CLI.
   This package was written by hand to the same structure rather than generated,
   so if a reviewer objects to anything it will be a convention rather than a
   requirement.

8. **Submit the template.** Paste the contents of
   `templates/silent-fail-heartbeat.json`. It carries `PASTE_YOUR_MONITOR_TOKEN`
   as the URL, not a real token, and it needs to stay that way.

## Version bumps

The workflow publishes whatever version is in `package.json`. npm refuses to
republish a version that already exists, so bump it before each release or the
job fails on the last step after doing all the work.

## Trying it before any of that

The package does not need to be on npm to be installed. From this directory:

    npm run build
    npm pack

That produces `n8n-nodes-silentfail-0.1.0.tgz`. On the target n8n instance:

    cd ~/.n8n/nodes
    npm install /path/to/n8n-nodes-silentfail-0.1.0.tgz

Restart n8n and the node appears in the palette. This is exactly how it was
tested, and it is worth knowing because it also means you can install a fix on
your own instance without waiting for a release.

Note that `~/.n8n/nodes` is the right directory and `~/.n8n/custom` is not. Both
load nodes, but the custom directory registers them under a `CUSTOM.` prefix
instead of the package name, so a workflow that refers to
`n8n-nodes-silentfail.silentFail` will not find them.

## Once it is published

Self hosted n8n installs it from Settings, Community nodes, by typing the package
name. n8n Cloud only allows verified nodes, so Cloud users cannot install it
until the verification in step 7 goes through.

## What was tested before this was handed over

Against n8n 2.36.9 in Docker, with the packed tarball installed into
`~/.n8n/nodes`, pointed at a real monitor on silentfailapp.com:

- The node registers under its real package name,
  `n8n-nodes-silentfail.silentFail`, and the editor lists it with its display
  name, its icon, all five properties and the credential binding. The icon file
  is served.
- Executing it with a pasted ping URL returned `pinged: true` along with the
  monitor name, status and a `receivedAt` timestamp generated by production.
- Executing it with the ping URL held in a `Silent Fail Monitor` credential did
  the same. The credential field is masked in the editor and the stored value is
  encrypted at rest, with no trace of the URL in plaintext in n8n's database.
- The template was imported and activated, and its schedule trigger fired on its
  own with no CLI involvement. The stored execution shows the HTTP Request node
  calling the production ping URL and production answering with the monitor name
  and status.

Not tested: the editor as a human sees it, meaning the palette entry, the icon
rendering and the field layout were confirmed from the data the editor serves
rather than by clicking through a browser. Also untested is anything to do with
npm or n8n's verification, since neither has happened yet.
