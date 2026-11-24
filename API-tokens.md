# API tokens

API tokens let dashboards (Homepage, Homarr, Grafana…) and scripts call the [[REST API]] without a browser session.

## Creating a token

*Account → API tokens*: **Name**, **Access** and **Expires** (30 days, 90 days, 1 year or never).

The token (`rw_…`) is shown **only once** – copy it right away. The server keeps only a SHA-256 hash.

| Access | Allows |
| --- | --- |
| **Read only** | `GET` / `HEAD` only (`403` for anything else) – enough for dashboards |
| **Full access** | everything, including starting checks, updates and upgrades on your machines |

No token can reach the account endpoints (`/api/auth/*` → `403`): tokens cannot change the password, passkeys,
sessions or other tokens. Unknown, revoked and expired tokens get `401`.

The list shows when and from which address each token was last used. **Revoke** a token there.

## Using a token

Send it with either header:

```bash
curl -H "Authorization: Bearer rw_…" https://watcher.example.com/api/status
curl -H "X-API-Key: rw_…" https://watcher.example.com/api/status
```

## Homepage widget

`services.yaml`:

```yaml
- Monitoring:
    - ReleaseWatcher:
        href: https://watcher.example.com
        icon: mdi-update
        widget:
          type: customapi
          url: https://watcher.example.com/api/status
          refreshInterval: 60000
          headers:
            X-API-Key: rw_… # a read-only token
          mappings:
            - field: { repositories: updatesAvailable }
              label: Updates
            - field: { targets: packagesPending }
              label: Package updates
            - field: { targets: appUpdatesAvailable }
              label: App updates
            - field: { advisories: affecting }
              label: Vulnerabilities
```

Other counters in `GET /api/status`: `repositories.total` / `withErrors`, `targets.total` / `withErrors` /
`homeAssistantUpdatesAvailable`, `advisories.total`.

## Script examples

Check all repositories now (full-access token):

```bash
curl -X POST -H "X-API-Key: $RW_TOKEN" https://watcher.example.com/api/check-all
```

List repositories with an available update (needs `jq`):

```bash
curl -s -H "X-API-Key: $RW_TOKEN" https://watcher.example.com/api/repositories \
  | jq -r '.[] | select(.updateAvailable) | "\(.fullName): \(.installedVersion) → \(.lastSeenTag)"'
```

> Field names: see `web/src/app/core/models.ts` in the repository or inspect a response – the API uses camelCase and
> `null` for missing values.

Start a package upgrade of a machine and follow the run:

```bash
run=$(curl -s -X POST -H "X-API-Key: $RW_TOKEN" -H 'Content-Type: application/json' \
  -d '{"backup": true}' https://watcher.example.com/api/targets/3/packages-upgrade | jq -r .id)
curl -s -H "X-API-Key: $RW_TOKEN" https://watcher.example.com/api/runs/$run | jq -r .status   # running, succeeded or failed
```
