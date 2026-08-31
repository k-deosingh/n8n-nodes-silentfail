# Publishing and submitting this package

Nothing here has been published. No release has been cut and the name
`n8n-nodes-silentfail` is unclaimed as far as this repository knows. The steps
below are the ones only you can do, because they need accounts.

**You do not need an npm access token.** npm is right to warn you off one for
CI, and the workflow in `.github/workflows/publish.yml` does not use one. It uses
trusted publishing instead.

## What trusted publishing is, in one paragraph

You tell npm, once, that this exact repository and this exact workflow file are
allowed to publish this package. When the workflow runs, GitHub hands it a short
lived signed statement of who it is, npm checks that against what you configured,
and issues a credential good for that one publish. Nothing long lived is stored
anywhere. An automation token, by contrast, sits in repository secrets forever
and can publish from anywhere it leaks to, which is exactly what the warning you
saw is about. Trusted publishing also generates the provenance statement
automatically, which n8n requires for verification from 1 May 2026, so this is
the route that satisfies both concerns at once.

## The one wrinkle

npm configures a trusted publisher on a **package's** settings page, and a
package that has never been published has no settings page. npm's own
documentation does not say either way whether a brand new name can be configured
in advance, so the order below claims the name first without ever creating a
token. If npm does let you add a trusted publisher for a name that does not exist
yet, skip step 2 and go straight to step 3.

## Steps

1. **npm account.** Create one for contact@silentfailapp.com and turn on two
   factor authentication. Then, on your own machine, run `npm login` from
   anywhere. That is a browser login, not a token, so the warning you saw does
   not apply to it.

2. **Claim the name with one manual publish.** From this directory:

       npm install
       npm publish --access public

   `prepublishOnly` builds `dist` for you, so there is no way to publish a stale
   or missing build. This version will have no provenance statement, which is
   expected and fine, because it exists to create the package so that step 3
   becomes possible. Do not submit this version to n8n.

3. **Configure trusted publishing.** On npmjs.com, open the package, go to
   Settings, and add a trusted publisher with:

   - Publisher: GitHub Actions
   - Organization or user: `k-deosingh`
   - Repository: `n8n-nodes-silentfail`
   - Workflow filename: `publish.yml` (filename only, not a path)
   - Environment: leave empty
   - Allowed actions: `npm publish`

   These have to match the real repository and filename exactly. A mismatch is
   the most common reason a trusted publish is rejected, and the error names the
   mismatch, so read it rather than guessing.

4. **Bump the version.** npm refuses to republish a version that already exists,
   so change `version` in `package.json` to `0.1.1` and commit it. Skipping this
   makes the workflow fail on its very last step after doing all the work.

5. **Release it.** Create a GitHub release, or trigger the workflow by hand from
   the Actions tab. It typechecks, builds, asserts the three files
   `package.json` promises actually exist, then publishes. No secret needs to be
   set on the repository for any of this.

6. **Check it landed.** `npm view n8n-nodes-silentfail` should show 0.1.1, and the
   package page on npm should show a provenance section naming the commit it was
   built from. If provenance is missing, the `id-token: write` permission was
   dropped. If the publish itself was rejected, compare the repository and
   workflow filename in the error against what you entered in step 3.

7. **Submit for verification.** Sign in at creators.n8n.io and submit the node.
   The same portal is where workflow templates are shared, so the template goes
   in at the same time.

   Two things from their guidelines worth knowing before you submit: they want no
   runtime dependencies, which this package satisfies because `n8n-workflow` is
   only a peer and dev dependency and there is no `dependencies` block at all;
   and they strongly suggest scaffolding with their `n8n-node` CLI. This package
   was written by hand to the same structure rather than generated, so if a
   reviewer objects to anything it will be a convention rather than a
   requirement.

8. **Submit the template.** Paste the contents of
   `templates/silent-fail-heartbeat.json`. It carries `PASTE_YOUR_MONITOR_TOKEN`
   as the URL rather than a real token, and it needs to stay that way.

## Later releases

Bump the version, cut a release, done. Step 2 never happens again, and after
step 3 every published version carries provenance.

## Passing the submission scan

n8n runs `npx @n8n/scan-community-package` against the published package and the
public repository its provenance names. `npm run lint` here is the same eslint
config that scan uses, so a green lint is the check that gates verification. Run
it before every release.

Two things worth knowing if you ever run that scan yourself:

- On Windows it fails while extracting the source with a tar path error. That is
  the tool, not the package. Run it under Linux or in a container.
- Its credential rule walks up from the node file looking for package.json and
  stops one directory short of the filesystem root, so a package checked out at
  a first level path like /pkg reports "credential not defined in this package"
  when it is defined. Check out somewhere deeper and it passes.

The one remaining warning is `credential-unnecessary-password`, which says the
`pingUrl` field does not look sensitive. It is: that URL is the whole of the
authentication for a monitor. The scan only fails on errors, so the warning is
left standing rather than fixed by removing the masking.

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
rather than by clicking through a browser. Also untested is the publish itself,
including the trusted publishing configuration, since none of that can be
exercised before the account exists.
