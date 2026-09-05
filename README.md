# n8n-nodes-silentfail

An n8n community node for [Silent Fail](https://silentfailapp.com). It tells Silent Fail that your workflow finished, so you get an email when it stops.

## What problem this solves

n8n's error handling catches a workflow that fails. It cannot catch a workflow that stops running, because a workflow that never starts produces no error and therefore no notification. A schedule that got deactivated, a credential that expired, an instance that went down, a trigger that quietly stopped firing: all of these are silent.

The pattern that catches absence is a dead man's switch. Your workflow checks in on a schedule. If a check-in does not arrive when expected, something is wrong, and that is the signal.

This node is the check-in. Add it as the last step, and if the pings stop arriving you get an email.

## Install

In n8n, go to **Settings > Community nodes**, choose **Install a community node**, and enter:

```
n8n-nodes-silentfail
```

Self hosted n8n only. n8n Cloud allows verified nodes only.

## Use it

1. Create a monitor at [silentfailapp.com](https://silentfailapp.com) and copy its ping URL.
2. Add the **Silent Fail** node as the last step of the workflow you want watched, and pick the **Ping a monitor** action.
3. Paste the ping URL, or save it as a **Silent Fail Monitor** credential and select that instead.
4. Activate the workflow.

That is the whole setup. There is no API key and no OAuth, because the unguessable token inside the ping URL is the only secret Silent Fail uses.

### Operations

The node has one resource, **Monitor**, with two operations.

| Operation | Action | What it does |
| --- | --- | --- |
| Ping | Ping a monitor | Records a check-in. This is the one you want at the end of a workflow: if the pings stop arriving, Silent Fail emails you. |
| Get Status | Get a monitor status | Reads whether the monitor exists and is being watched. It records nothing and changes nothing, so asking never marks a dead workflow as alive. |

Get Status is useful when a workflow needs to know its own monitoring is set up, or when you want a health check that does not itself count as a check-in.

### Ping URL or credential

Both work. The difference matters if you share workflows.

A URL typed into the node field travels inside the exported workflow JSON. Since that URL is the entire authentication, a workflow posted in a forum or committed to a repository hands it to whoever reads it. A credential is encrypted at rest and is left out of an export, so use one if the workflow will be shared.

The credential is called **Silent Fail Monitor API** and holds one field, the ping URL. There is no API key to find, because there is no API key. Its Test button checks that the monitor exists without pinging it, so testing a credential never tells Silent Fail your workflow ran.

### Method and options

**Method.** On Ping only. GET or POST, and Silent Fail treats them identically. GET is the simpler default. Use POST if something between you and us blocks or caches GET requests.

**Timeout.** How long to wait before giving up. The endpoint answers in well under a second, so this only matters on a bad connection.

**Ignore failures.** Off by default, which means a failed request fails the run. That is louder, and it tells you the monitoring itself is broken rather than hiding it. Turn it on if the work the workflow does matters more than the monitoring of it.

## What the node returns

Ping:

```json
{
  "pinged": true,
  "monitor": "Nightly invoice sync",
  "status": "up",
  "receivedAt": "2026-08-31T09:00:04.512Z",
  "recovered": false
}
```

`recovered` is true when this particular ping closed an outage, so a workflow can react to its own recovery if it wants to.

Get Status:

```json
{
  "monitor": "Nightly invoice sync",
  "watching": true
}
```

`watching` is false when the monitor still accepts pings but nobody is being alerted, so "the URL works" and "you would be told if it stopped" stay separate questions.

## Choosing a schedule and a grace period

Set the monitor's expected schedule in Silent Fail to match how often the workflow runs. New monitors get a grace period of twice the interval by default, so a job that usually takes four minutes and occasionally takes nine does not trigger a false alarm.

A workflow that runs every hour with a two hour grace period alerts if nothing arrives for three hours. Widen the grace period if your run duration varies a lot.

## Alerts

Email only. One email when a monitor goes down, nothing more until it recovers, then one all clear. There is no SMS, no Slack app and no webhook out, so if you need a paging rota this is not the right tool.

## Without this node

The node is a convenience. A plain **HTTP Request** node pointed at the same URL does exactly the same thing, and there is a ready made workflow that does it that way in the `templates` directory of the [repository](https://github.com/k-deosingh/n8n-nodes-silentfail), which is not shipped inside this package. Use whichever you prefer.

## Working on this node

```bash
npm install
npm run lint      # n8n's own eslint config for community nodes
npm run build
npm run dev       # runs n8n locally with this node loaded
```

`npm run lint` is the same check that gates n8n's verification, so keep it green.

## Licence

MIT.
