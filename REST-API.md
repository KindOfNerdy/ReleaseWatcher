# REST API

A JSON REST API under `/api` – the same one the UI uses.

## Basics

- **Authentication:** everything except `/health`, `/api/version` and the public auth endpoints needs a session cookie
  or an [[API token|API tokens]] (`Authorization: Bearer rw_…` or `X-API-Key: rw_…`); otherwise `401`.
- **JSON in camelCase**, dates as ISO 8601 strings, missing values as `null`.
- **Errors** are [problem details](https://www.rfc-editor.org/rfc/rfc9457):
  `{ "status": 400, "title": "…", "detail": "…", "errors": { "field": ["message"] } }`. Messages are full sentences.
- **Partial updates** (`PUT`): property **omitted = keep**, **`null` = reset/remove**, value = set. Secrets follow the
  same rule, so you never need to send a saved secret back.
- **Secrets** are never returned – only `hasX` flags and masked hints.
- **Long operations** return `202 Accepted` with a run and a `Location: /api/runs/:id` header; poll the run.
- **Long lists** are paged with an opaque `cursor` (`{ items, nextCursor }`); pass `nextCursor` to get the next page.
- Every `/api/*` response is `Cache-Control: no-store`.
- Cross-site state-changing requests are refused (Origin check).

### Status codes

| Code | Meaning |
| --- | --- |
| `200` / `201` / `204` | read or update / created / deleted |
| `202` | background run started |
| `400` | validation error (see `errors`) |
| `401` / `403` | not signed in / token not allowed (read-only token, `/api/auth/*`) |
| `404` | unknown id |
| `409` | conflict with the current state (task already running, feature disabled…) |
| `429` | too many failed logins |
| `502` | upstream failure (GitHub, node, Docker endpoint) |

### Following a run

```bash
curl -s -H "X-API-Key: $T" "https://watcher/api/runs/42"                 # status, output, outputCursor
curl -s -H "X-API-Key: $T" "https://watcher/api/runs/42?after=<outputCursor>"  # only new output
```

`status` is `running`, `succeeded` or `failed`. With `?after=`, `outputAppend: true` means `output` continues what you
already have.

## Repositories, settings and status

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/repositories` | List watched repositories |
| `POST` | `/api/repositories` | `{ "repository": "owner/repo", "provider"?: "gitea" \| "gitlab", "includePrereleases": false, "githubToken"?: "github_pat_…" }` – `repository` is `owner/repo` (GitHub) or the HTTPS URL of a GitHub, Gitea/Forgejo or GitLab repository; `provider` only for a host that isn't well known (detected when omitted); `githubToken` is the repository's own token on any host. Responses carry `provider` (`github`/`gitea`/`gitlab`), `host` (null on GitHub), `fullName` (`host/owner/name` outside GitHub), `url` and `avatarUrl` (null for GitLab) |
| `PUT` | `/api/repositories/:id` | `{ "includePrereleases", "isEnabled", "installedVersionUrl"?, "installedVersionField"?, "installedVersionHeaders"?: [{ "name", "value" }], "installedVersion"?, "githubToken"?, "osvEcosystem"?, "osvPackage"?, "icon"? }` – a header with `value: null` keeps the saved value; `installedVersion` only without a URL (`400` otherwise). Response has `installedVersionSource` (`none`/`url`/`manual`) and `iconUrls` |
| `POST` | `/api/repositories/:id/mark-installed` | Set the hand-entered installed version to the latest release (`409` with a URL or before the first release is known) |
| `DELETE` | `/api/repositories/:id` | Stop watching |
| `POST` | `/api/repositories/:id/check` | Check now (incl. advisories); also checks machines whose linked app is behind the newest release (`containerChecks`) |
| `GET` | `/api/repositories/:id/advisories` | Vulnerabilities of the repository with `source`, `affectsInstalled` (`true`/`false`/`null`), `affectedVersions` |
| `GET` | `/api/advisories` | One page of all vulnerabilities. Query: `impact` (`all`/`affecting`/`unknown`/`unaffected`), `severity`, `source`, `q`, `limit` (1–200, default 50), `cursor`. Returns `{ items, nextCursor, total, overview }` (`total`/`overview` on the first page only) |
| `POST` | `/api/installed-version/test` | `{ "url", "field": null, "headers": [], "repositoryId"? }` → detected version and response preview |
| `POST` | `/api/check-all` | Check all active repositories now |
| `GET` | `/api/notifiers` | Notifiers (`discord`, `email`, `ntfy`, `gotify`, `telegram`, `slack`, `pushover`, `webhook`) and whether they are configured |
| `POST` | `/api/notifiers/test` | Test all enabled notifiers, or `{ "notifier": "telegram" }` (`409` when not configured) |
| `GET` | `/api/settings` | Effective settings (secrets masked) and where each value comes from |
| `PUT` | `/api/settings` | Partial update; omitted = keep, `null` = reset to the environment value |

The settings of ntfy, Gotify, Telegram, Slack, Pushover and the webhook come as `channels.<name>` =
`{ configured, settings: { <key>: { value, secret, configured, source } } }`; for a secret `value` is only a masked hint
(`…abcd`). They are saved with the same keys in `PUT /api/settings` (`ntfyUrl`, `ntfyTopic`, `ntfyToken`, `gotifyUrl`,
`gotifyToken`, `telegramBotToken`, `telegramChatId`, `slackWebhookUrl`, `pushoverUserKey`, `pushoverAppToken`,
`webhookUrl`, `webhookMethod`). The webhook's headers come as `channels.webhook.headers` = `[{ name, hasValue }]` and are
replaced with `webhookHeaders: [{ name, value }]` (`value: null` keeps the saved value, `null` or `[]` removes all).
`notifications.dockerUpdates` / `notifyDockerUpdates` switches the *New Docker images* type.
| `GET` | `/api/status` | App version, scheduled checks (`poller`, `advisoryPoller`: cron, running, last/next run), counters |
| `GET` | `/api/github/rate-limit` | Remaining GitHub API quota |
| `GET` | `/api/version` | `{ "version": "1.5.0" }` (public) |
| `GET` | `/health` | Liveness (public) |

## SSH keys and hosts

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/ssh-keys` | Keys: name, public key, fingerprint, `hostCount` (never the private key) |
| `POST` | `/api/ssh-keys` | Add `{ name, privateKey }` (checked with `ssh-keygen`) |
| `POST` | `/api/ssh-keys/generate` | Create an Ed25519 key `{ name }`; returns the public key |
| `PUT` | `/api/ssh-keys/:id` | Rename `{ name }` |
| `DELETE` | `/api/ssh-keys/:id` | Remove (`409` while a host uses it) |
| `GET` | `/api/hosts` | Hosts (`type`: `proxmox` / `server`) with address, port, user, key, `configured`, `targetCount` |
| `POST` | `/api/hosts` | `{ type, name?, address, port?, user?, sshKeyId? }`; a `server` gets its machine right away |
| `GET` / `PUT` / `DELETE` | `/api/hosts/:id` | One host; partial update; delete (a node: `409` while it has watched machines) |
| `POST` | `/api/hosts/:id/test` | Connect; returns `pveversion` (Proxmox) or `uname -a` |
| `POST` | `/api/hosts/:id/forget-host-key` | Remove the pinned SSH host key |

## Proxmox and machines

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/proxmox/test` | Connect to a node, returns `pveversion`. `/api/proxmox/*`, `POST /api/containers/node` and `add-all` take `?hostId=` (default: first node) |
| `GET` | `/api/proxmox/containers` | Guests on the node (`pct list` + `qm list`) with `kind` (`lxc`/`vm`) and `added` |
| `GET` | `/api/proxmox/storages` | Storages of a node (`?hostId=`) that accept backups |
| `GET` | `/api/containers` | Watched machines (`kind`: `lxc`, `vm`, `node`, `server`) with `hostId`, `capabilities`, apps, pending updates (`aptUpgradable` – system packages of any package manager, despite the name), `packageManager` (`apt`, `dnf`, `yum`, `zypper`, `apk`, `pacman` or `null` before the first check), `appStores` (`[{ "store": "flatpak" | "snap", "label", "packages" }]` – only installed stores), `restartReasons`, `os`, `isBusy`, `activeRunId` |
| `POST` | `/api/containers` | `{ "vmid": 101, "name"?, "hostId"? }` – add a container/VM and start a check |
| `POST` | `/api/containers/node` | Add the Proxmox node itself (`409` when already added) |
| `POST` | `/api/containers/add-all` | Add every container not added yet (VMs one by one) |
| `PUT` | `/api/containers/:id` | `{ "name", "isEnabled", "aptEnabled", "backupBeforeUpdate"?, "startWhenStopped"?, "checkCron"?, "updateCores"?, "updateMemoryMb"?, "homeAssistantUrl"?, "homeAssistantToken"?, "homeAssistantInstall"?, "dockerEnabled"? }` – `null` = default/remove, omitted = keep |
| `DELETE` | `/api/containers/:id` | Remove (`409` while a task runs) |
| `POST` | `/api/containers/check-all` | Queue a check of all enabled machines (`202`) |
| `POST` | `/api/containers/update-all` | Update every machine with pending updates (or `ids`) one after another; `{ "backup"?, "ids"? }` → `202` |
| `POST` | `/api/containers/:id/update-all` | All pending updates of one machine; `{ "backup"? }` |
| `POST` | `/api/containers/:id/check` | Start a check → `202` |
| `POST` | `/api/containers/:id/restart` | Restart (`pct reboot` / `qm reboot` / node reboot / server reboot) → `202` (`409` while updates run) |
| `POST` | `/api/containers/:id/flatpak-update`, `/snap-update` | Update every Flatpak / Snap application → `202`; `{ "backup"? }` (`409` when the last check did not find that store) |
| `POST` | `/api/containers/:id/apt-upgrade` | Upgrade the system packages with the machine's package manager (node: `apt-get dist-upgrade`, no backup) → `202`; `{ "backup"? }` |
| `POST` | `/api/containers/:id/home-assistant-update` | Install Home Assistant updates → `202`; `{ "backup"?, "ids"? }` |
| `POST` | `/api/containers/:id/apps` | `{ "name", "versionCommand", "latestSource": "none" \| "github" \| "command", "repositoryId", "latestCommand", "updateCommand", "useTty", "timeoutSeconds", "installedVersion"? }` |
| `PUT` / `DELETE` | `/api/containers/:id/apps/:appId` | Edit / remove an application |
| `POST` | `/api/containers/:id/apps/:appId/mark-installed` | Set a hand-entered app version to the latest (`409` with a version command) |
| `POST` | `/api/containers/:id/apps/:appId/update` | Run the update command → `202`; `{ "backup"? }` |
| `POST` | `/api/containers/:id/detect-apps` | Applications found in a running machine (nothing saved) |
| `GET` | `/api/containers/:id/runs` | Run history without output: `{ items, nextCursor }`; `?limit=` (1–100, default 20), `?cursor=` |
| `GET` | `/api/runs/:id` | One run with output; `?after=<outputCursor>` for new output only |

## Docker

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/docker` | `{ endpoints, containers, check }` – containers with `source`, `installedVersion` + `installedVersionSource` (`tag`/`label`/`digest`), `repository`, `suggestedRepository`, `updateAvailable`, `registry` (`state`: `up-to-date`/`update-available`/`unknown`), `composeProject`, `ignored`, `present` |
| `POST` | `/api/docker/check` | List endpoints and ask registries now → `202` |
| `GET` | `/api/docker/endpoints` | Docker endpoints |
| `POST` | `/api/docker/endpoints` | `{ "name", "url" }` → `201`, starts a check |
| `POST` | `/api/docker/endpoints/test` | `{ "url" }` → `{ engine, containers }` (nothing saved; `502` when unreadable) |
| `PUT` / `DELETE` | `/api/docker/endpoints/:id` | `{ "name", "url", "isEnabled"? }` / remove with its containers |
| `POST` | `/api/docker/endpoints/:id/check` | Check one endpoint → `202` (`409` while checked) |
| `PUT` | `/api/docker/containers/:id` | `{ "ignored"?, "linkAuto"?, "repositoryId"? }` |

## Authentication

API tokens cannot call any `/api/auth/*` route (`403`).

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/auth/state` | `{ setupRequired, authenticated, username, hasPasskeys, passwordLogin, oidcLogin }` (public; `oidcLogin` = provider name when single sign-on works, else `null`) |
| `POST` | `/api/auth/setup` | `{ "code", "username", "password" }` – first account only (public) |
| `POST` | `/api/auth/login` | `{ "username", "password" }` → session cookie (public; `429` after failures, `409` when password sign-in is off) |
| `POST` | `/api/auth/passkey/options`, `/api/auth/passkey/login` | Passkey sign-in (public) |
| `POST` | `/api/auth/oidc/login` | Start single sign-on → `{ url }` of the provider + a binding cookie (public; `409` when not set up or not linked) |
| `GET` | `/api/auth/oidc/callback` | Redirect URI of the provider; `303` to `/` signed in, `/account?sso=linked`, or `/login` / `/account` with `?ssoError=` (public) |
| `GET` / `PUT` | `/api/auth/oidc` | Single sign-on settings `{ configured, issuer, clientId, hasClientSecret, clientSecretMasked, name, *Source, redirectUri, link }` / save `{ "currentPassword", "issuer"?, "clientId"?, "clientSecret"?, "name"? }` (omitted = keep, `null` = environment value) |
| `POST` / `DELETE` | `/api/auth/oidc/link` | Start linking the account → `{ url }` / unlink (`409` while it is the only way to sign in) |
| `POST` | `/api/auth/logout` | End the current session |
| `PUT` | `/api/auth/account` | `{ "currentPassword", "username"?, "newPassword"?, "passwordLogin"? }` |
| `GET` / `POST` | `/api/auth/passkeys` | List / register (after `POST /api/auth/passkeys/options`) |
| `PATCH` / `DELETE` | `/api/auth/passkeys/:id` | Rename / remove |
| `GET` / `DELETE` | `/api/auth/sessions` | List / sign out all other sessions |
| `DELETE` | `/api/auth/sessions/:id` | Sign out one session |
| `GET` / `POST` | `/api/auth/api-tokens` | List / create `{ "name", "scope": "read" \| "full", "expiresInDays"?: 1–3650 \| null }` → `201` with `token` (shown once) |
| `DELETE` | `/api/auth/api-tokens/:id` | Revoke |

The authoritative types are in
[`web/src/app/core/models.ts`](https://github.com/Rozumek29/ReleaseWatcher/blob/main/web/src/app/core/models.ts).
