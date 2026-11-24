# Notifications

ReleaseWatcher sends notifications over **Discord** (webhook), **e-mail** (built-in SMTP client), **ntfy**, **Gotify**,
**Telegram**, **Slack**, **Pushover** and a generic **webhook**. Any number of them can be active at once; a failure in
one channel does not block the others. Configure them in **Settings → Notifications** (or
with environment variables – [[Configuration]]).

## Discord

1. In Discord: *channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL*.
2. Paste it as **Webhook URL**. Optional: **Mention** (`@here`, `@everyone`, `<@&ROLE_ID>`) shown above the embed,
   and **Bot name** (default `ReleaseWatcher`).
3. **Test** sends a sample release.

Release messages are embeds with the release notes (truncated to `DISCORD_MAX_BODY_LENGTH`, default 1500 characters),
the installed version when known, and the repository icon as the author icon ([[Repositories]]). Machine notifications
link to the app when `PUBLIC_URL` is set. The webhook URL is a secret: encrypted at rest and shown only masked.

## E-mail

| Field | Notes |
| --- | --- |
| SMTP server / Port | e.g. `smtp.gmail.com` / `587` |
| Security | `starttls` (usually 587), `tls` (usually 465) or `none`; certificates are always verified |
| User name / Password | AUTH PLAIN or LOGIN; empty = no login. Gmail and Outlook need an **app password** (account security settings → App passwords) |
| From | `alerts@example.com` or `ReleaseWatcher <alerts@example.com>` |
| To | comma-separated, up to 20 recipients |

E-mail is enabled when the server, *From* and *To* are set. Release notes are truncated to `EMAIL_MAX_BODY_LENGTH`
(default 5000). The password is encrypted at rest; leave the field empty to keep the saved one.

## More channels

Under *More channels* each channel has its own card with **Save**, **Send test** and **Remove** (removes the values
saved in the UI; environment values apply again). Tokens, keys and webhook URLs are secrets: encrypted at rest, shown
only masked, and an empty field keeps the saved value.

| Channel | What you need | Where to get it |
| --- | --- | --- |
| **ntfy** | Topic; server (empty = `https://ntfy.sh`); access token only for protected topics | Subscribe to the topic in the ntfy app. On ntfy.sh anyone who knows a topic can read it – pick a hard-to-guess name. Tokens: ntfy web app → *Account → Access tokens* (`user:password` works too). |
| **Gotify** | Server URL and an app token | Gotify → *Apps → Create application* |
| **Telegram** | Bot token and chat ID | Message @BotFather → `/newbot`, add the bot to your chat, send it a message and read `chat.id` from `https://api.telegram.org/bot<token>/getUpdates` (groups and channels start with `-100`; a public channel can be `@name`). |
| **Slack** | Incoming webhook URL | Slack → *Apps → Incoming WebHooks → Add to Slack* → pick a channel |
| **Pushover** | User key and API token | User key: top of the Pushover dashboard; token: *Create an Application/API Token* |
| **Webhook** | Any URL that accepts JSON; method `POST` (default), `PUT` or `PATCH`; optional request headers | n8n, Node-RED, Home Assistant, an Apprise API server … |

ntfy and Gotify get Markdown, Telegram and Pushover HTML, Slack mrkdwn. Release notes are added while they fit the
channel's limit (Pushover: 1024 characters, so mostly without notes); long lists end with *… and N more*. Vulnerabilities
of high or critical severity and failed updates are sent with a higher priority (ntfy, Gotify, Pushover); finished
updates with a low one (Telegram: silent).

### Webhook payload

```json
{
  "source": "releasewatcher",
  "type": "release",
  "title": "immich-app/immich v1.120.0",
  "message": "Release\nInstalled: v1.119.1 → v1.120.0\n\n…release notes…",
  "url": "https://github.com/immich-app/immich/releases/tag/v1.120.0",
  "priority": "normal",
  "events": [{ "type": "release", "release": { "owner": "immich-app", "repository": "immich", "release": { "tag": "v1.120.0", "…": "…" } } }]
}
```

`type` is `release`, `vulnerability`, `container-updates`, `update-result`, `docker-updates` or `digest` (a summary of
several events); `priority` is `low`, `normal` or `high`. `events` holds the notifications themselves for automations
that need the data. Any non-2xx answer counts as a failure (`429` is retried).

**Request headers** (up to 10, e.g. `Authorization: Bearer …` or `X-Api-Key`) are sent with every call and can replace
the default `Content-Type: application/json`. Their values are encrypted at rest and never shown again: a saved header
with an empty value field keeps its value.

## What to send

Applies to every channel:

| Type | Default | When |
| --- | --- | --- |
| **New releases** | on | a watched repository published a new release (not sent if the installed version is already ≥ the release) |
| **New vulnerabilities** | on | a security advisory was published for a watched repository – skipped when the installed version is known not to be affected |
| **Application updates** | on | a newer version of an application in a container, VM or server |
| **System package updates** | on | upgradable packages (apt, dnf, zypper, apk, pacman …) and Flatpak / Snap updates on a machine or the Proxmox host |
| **Update finished** | off | an update or package upgrade started in ReleaseWatcher completed |
| **Update failed** | off | an update or package upgrade started in ReleaseWatcher failed |
| **New Docker images** | on | a newer image was pushed for the tag a Docker/Podman container runs ([[Docker containers]]) |

Each pending machine item (a package set, an app version) is notified **once**. Each new Docker image (registry digest of
a tag) is reported once too – also while the type is switched off, so switching it on later does not report old images.
Images that were already *New image* before the update to this version are not reported; the next push is.

Limits per check: at most 5 new releases and 5 new vulnerabilities per repository.

## One summary per check (digest)

**Send one summary per check** (`NOTIFICATION_DIGEST=true`) collects everything one run finds and sends **one message
per channel** when the run ends, instead of one message per item:

- a run of all repositories (scheduled or *Check all now*),
- the scheduled machine checks, or *check all* on the Machines page,
- the scheduled Docker check,
- runs falling into the same minute (releases → vulnerabilities → containers → Docker) are combined into one summary.

Checking a single repository or machine still notifies right away. Items held back for a summary are lost if the
process stops before the run ends – they are never sent twice.

## Testing

**Test** next to each channel sends a sample release to that channel only (`POST /api/notifiers/test`). A `409` means
the channel is not configured yet.

## Adding another channel

For a service that is not built in, use the **Webhook** channel (or an Apprise API server behind it). Developers can
implement the `Notifier` interface (`SimpleNotifier` covers message-based services) – see [[Development]].
