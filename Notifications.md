# Notifications

ReleaseWatcher sends notifications over **Discord** (webhook) and **e-mail** (built-in SMTP client). Both can be
active at once; a failure in one channel does not block the other. Configure them in **Settings → Notifications** (or
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

## What to send

Applies to every channel:

| Type | Default | When |
| --- | --- | --- |
| **New releases** | on | a watched repository published a new release (not sent if the installed version is already ≥ the release) |
| **New vulnerabilities** | on | a security advisory was published for a watched repository – skipped when the installed version is known not to be affected |
| **Application updates** | on | a newer version of an application in a container, VM or server |
| **apt package updates** | on | upgradable packages in a container or on the Proxmox host |
| **Update finished** | off | an update or apt upgrade started in ReleaseWatcher completed |
| **Update failed** | off | an update or apt upgrade started in ReleaseWatcher failed |

Each pending machine item (a package set, an app version) is notified **once**. Docker *New image* states are shown in
the UI but are not notified.

Limits per check: at most 5 new releases and 5 new vulnerabilities per repository.

## One summary per check (digest)

**Send one summary per check** (`NOTIFICATION_DIGEST=true`) collects everything one run finds and sends **one message
per channel** when the run ends, instead of one message per item:

- a run of all repositories (scheduled or *Check all now*),
- the scheduled machine checks, or *check all* on the Machines page,
- runs falling into the same minute (releases → vulnerabilities → containers) are combined into one summary.

Checking a single repository or machine still notifies right away. Items held back for a summary are lost if the
process stops before the run ends – they are never sent twice.

## Testing

**Test** next to each channel sends a sample release to that channel only (`POST /api/notifiers/test`). A `409` means
the channel is not configured yet.

## Adding another channel (Slack, Teams, ntfy…)

Not built in yet. Developers can implement the `Notifier` interface – see [[Development]].
