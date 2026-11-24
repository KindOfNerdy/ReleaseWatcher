# Configuration

ReleaseWatcher reads environment variables (or a `.env` file in the working directory – see
[`.env.example`](https://github.com/Rozumek29/ReleaseWatcher/blob/main/.env.example)). **Almost everything can also be
changed in Settings**:

- values saved in the UI are stored in SQLite, **apply immediately** (no restart) and **override** the environment,
- clearing a value in the UI falls back to the environment value,
- secrets saved in the UI are encrypted at rest ([[Account and security]]).

Where to put variables:

| Install | File |
| --- | --- |
| Docker | `environment:` / `env_file:` in compose, or `-e` |
| Native / LXC | `/etc/releasewatcher/releasewatcher.env` (then `systemctl restart releasewatcher`) |
| From source | `.env` in the repository |

## Cron schedules

Every schedule is a 5-field cron expression – `minute hour day-of-month month day-of-week` – in the **server time
zone** (set `TZ`, e.g. `TZ=Europe/Warsaw`). Shortcuts like `@hourly` and `@daily` work too.

| Expression | Meaning |
| --- | --- |
| `*/15 * * * *` | every 15 minutes |
| `0 */6 * * *` | every 6 hours, on the hour |
| `30 3 * * *` | daily at 03:30 |
| `0 7 * * 1-5` | 07:00 on weekdays |

Runs due in the **same minute** are chained – releases, then vulnerabilities, then containers – and in digest mode
send one summary together. Runs missed while the app was stopped are caught up shortly after a start. Manual checks
never wait for the schedule.

## Settings page ↔ variables

| Settings tab → section | Variables |
| --- | --- |
| General → GitHub | `GITHUB_TOKEN` |
| General → Check schedules | `RELEASE_CHECK_CRON`, `ADVISORY_CHECK_CRON`, `DOCKER_CHECK_CRON` |
| General → Vulnerability sources | UI only (GitHub advisories, OSV.dev – both on by default) |
| General → Containers | `CONTAINER_CHECK_CRON`, `CONTAINER_CHECK_CONCURRENCY`, `BACKUP_BEFORE_UPDATE`, run history (UI only) |
| Connections | SSH keys, hosts, Docker endpoints (UI only; `PROXMOX_*` seed the first host) |
| Notifications → Discord | `DISCORD_WEBHOOK_URL`, `DISCORD_MENTION`, `DISCORD_USERNAME` |
| Notifications → E-mail | `SMTP_*`, `EMAIL_FROM`, `EMAIL_TO` |
| Notifications → More channels | `NTFY_*`, `GOTIFY_*`, `TELEGRAM_*`, `SLACK_WEBHOOK_URL`, `PUSHOVER_*`, `WEBHOOK_URL` |
| Notifications → What to send | `NOTIFICATION_DIGEST`, notification types (UI only) |
| Appearance | per browser, not on the server ([[Appearance]]) |

## Notifications

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_WEBHOOK_URL` | – | Discord channel webhook. Empty = Discord disabled. |
| `DISCORD_MENTION` | – | Text above the embed, e.g. `@here` or `<@&ROLE_ID>`. |
| `DISCORD_USERNAME` | `ReleaseWatcher` | Display name of the webhook. |
| `DISCORD_AVATAR_URL` | – | Avatar of the webhook. |
| `DISCORD_MAX_BODY_LENGTH` | `1500` | Release notes are truncated to this length. |
| `SMTP_HOST` | – | SMTP server. E-mail is enabled when host, `EMAIL_FROM` and `EMAIL_TO` are set. |
| `SMTP_PORT` | `587` | SMTP port. |
| `SMTP_SECURITY` | `starttls` | `starttls` (usually 587), `tls` (usually 465) or `none`. Certificates are always verified. |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | – | Login (PLAIN, LOGIN, CRAM-MD5 … picked automatically); empty = no login. |
| `EMAIL_FROM` | – | `alerts@example.com` or `ReleaseWatcher <alerts@example.com>`. |
| `EMAIL_TO` | – | Recipients, comma-separated (up to 20). |
| `EMAIL_MAX_BODY_LENGTH` | `5000` | Release notes in e-mails are truncated to this length. |
| `NTFY_URL` | `https://ntfy.sh` | ntfy server. |
| `NTFY_TOPIC` | – | ntfy topic. Empty = ntfy disabled. |
| `NTFY_TOKEN` | – | Access token (`tk_…`) or `user:password` for protected topics. |
| `GOTIFY_URL` / `GOTIFY_TOKEN` | – | Gotify server and application token. Both needed. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | – | Bot token from @BotFather and the chat (`-100…` or `@channelname`). Both needed. |
| `SLACK_WEBHOOK_URL` | – | Slack incoming webhook. |
| `PUSHOVER_USER_KEY` / `PUSHOVER_APP_TOKEN` | – | Pushover user (or group) key and application API token. Both needed. |
| `WEBHOOK_URL` | – | Generic webhook: every notification is sent as JSON. |
| `WEBHOOK_METHOD` | `POST` | `POST`, `PUT` or `PATCH`. Extra request headers are set in the UI only. |
| `NOTIFICATION_DIGEST` | `false` | `true` = what one check run finds is sent as one summary per channel. |

See [[Notifications]].

## GitHub and schedules

| Variable | Default | Description |
| --- | --- | --- |
| `GITHUB_TOKEN` | – | Optional PAT: 5000 instead of 60 requests/hour, private repositories. Fine-grained: *Contents: Read-only* (+ *Repository security advisories: Read-only* for private advisories); classic: `repo`. |
| `RELEASE_CHECK_CRON` | `*/15 * * * *` | New releases. |
| `ADVISORY_CHECK_CRON` | `0 */6 * * *` | Vulnerabilities (security advisories). |
| `DOCKER_CHECK_CRON` | `0 */6 * * *` | Docker endpoints and registry checks. |
| `POLL_INTERVAL_MINUTES` | – | Deprecated; used only without `RELEASE_CHECK_CRON` (converted, e.g. `15` → `*/15 * * * *`). |
| `POLL_INITIAL_DELAY_SECONDS` | `10` | Delay before the first release check after start. |

> Without a token GitHub allows 60 requests/hour per IP. Each repository costs one request per check (less with ETag
> hits), so for more than ~10 repositories every 15 minutes add a token.

## Machines (Proxmox, servers)

| Variable | Default | Description |
| --- | --- | --- |
| `PROXMOX_HOST` | – | Proxmox node, read **once** on the first start of a database: becomes a host in Settings → Connections. |
| `PROXMOX_SSH_PORT` | `22` | SSH port of that node (first start only). |
| `PROXMOX_SSH_USER` | `root` | SSH user (first start only); non-root users need passwordless `sudo` for `pct`/`qm`. |
| `PROXMOX_SSH_KEY_FILE` | – | Private key of that node (first start only; saved as the key *Proxmox node*). |
| `SSH_KNOWN_HOSTS_FILE` | `<database dir>/known_hosts` | Pinned host keys (trust on first use). |
| `CONTAINER_CHECK_CRON` | `0 */6 * * *` | Default check schedule of machines (each can override it). |
| `CONTAINER_CHECK_CONCURRENCY` | `3` | Machines checked at the same time (1–10). |
| `PROXMOX_BACKUP_STORAGE` | – | `vzdump` storage, read **once**: given to nodes without their own storage. |
| `BACKUP_BEFORE_UPDATE` | `false` | Back up before updates by default. |

Run history (UI only, *Settings → General → Containers → Run history per container*): how many checks and how many
other runs (updates, upgrades, restarts) to keep per machine – 1 to 500 each, empty = keep all.

See [[Connections and SSH]] and [[Machines]].

## Server, login, storage and logging

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | HTTP binding. |
| `DATABASE_PATH` | `releasewatcher.db` | SQLite file (`/data/releasewatcher.db` in Docker, `/var/lib/releasewatcher/releasewatcher.db` native). |
| `ENCRYPTION_KEY` | – | 32 bytes, base64 or hex (`openssl rand -base64 32`). Empty = `encryption.key` next to the database. |
| `PUBLIC_URL` | – | Public address behind a reverse proxy; pins the origin and the passkey relying party; used for links in Discord. |
| `TRUST_PROXY` | `false` | Take the client IP from `X-Forwarded-For` – only behind a proxy that sets it. |
| `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` | – | Upgrade path from old Basic-auth installs ([[Account and security]]). |
| `OIDC_ISSUER` | – | Single sign-on: issuer URL (or discovery URL) of the OpenID Connect provider. Also *Account → Single sign-on*. |
| `OIDC_CLIENT_ID` | – | Single sign-on: client ID at the provider. |
| `OIDC_CLIENT_SECRET` | – | Single sign-on: client secret; empty = public client (PKCE only). Secret. |
| `OIDC_NAME` | `OIDC` | Name on the *Sign in with …* button, e.g. `Pocket ID`. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent`. Logs are JSON lines. |
| `LOG_FILE` | – | Also write the log to this file. Docker: `/data/releasewatcher.log`; native: `/var/log/releasewatcher/releasewatcher.log`. |
| `LOG_FILE_MAX_SIZE_MB` | `10` | Rotate at this size (`0` = never); the old file becomes `<file>.1`. |
| `LOG_FILE_MAX_FILES` | `5` | Rotated files to keep; `0` = start the file over. |
| `TZ` | system | Time zone of all cron schedules. |

> [!TIP]
> Set `ENCRYPTION_KEY` in the environment (or as a Docker secret) instead of relying on `encryption.key` when a copy of
> the data directory alone should be useless.

## Example `.env`

```dotenv
TZ=Europe/Warsaw
GITHUB_TOKEN=github_pat_…
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/…
NOTIFICATION_DIGEST=true
RELEASE_CHECK_CRON=*/30 * * * *
CONTAINER_CHECK_CRON=0 6,18 * * *
PUBLIC_URL=https://watcher.example.com
TRUST_PROXY=true
LOG_FILE=/data/releasewatcher.log
```
