# Repositories

The **Repositories** page lists the GitHub repositories you watch for new releases.

## Adding a repository

Type `owner/repo` or paste any GitHub URL (`https://github.com/dani-garcia/vaultwarden`) and click **Watch**.
Optional when adding: *Pre-releases* and a *Token for this repository*.

What happens next:

1. The first check stores the newest existing release as a **baseline** – no notifications for history.
2. On `RELEASE_CHECK_CRON` (default every 15 minutes) and once shortly after a start, recent releases are fetched with
   conditional requests (`If-None-Match` / ETag – a `304` does not count against GitHub's rate limit).
3. Releases newer than the baseline are sent to your notifiers (oldest first, **max 5 per check**), and the baseline
   moves forward **after each one** – a crash never causes duplicates.
4. Drafts are ignored; pre-releases only if switched on for the repository.

A new release also starts a check of every enabled machine that has an application linked to this repository, so
*Update available* shows up there quickly ([[Applications and updates]]).

## The list

- Filters: **All, Active, Paused, Updates, Vulnerable, Errors** and a search box.
- **List or grid** layout (remembered per browser).
- Per repository: icon, latest release, installed version, badges (*Update available*, *N vulnerabilities affect
  installed* / *N advisories*, errors), actions **Check**, **Settings** (sliders icon), pause / resume, **Remove**
  (with an inline confirmation).
- **Check all now** in the sidebar checks every active repository.

## Repository settings

### Pre-releases and pause

*Pre-releases* includes GitHub pre-releases (betas, RCs). A **paused** repository is not checked and not notified.

### Installed version

*Installed version from* has three options:

| Option | Use for |
| --- | --- |
| **Nothing (no comparison)** | only announcing releases |
| **A version URL** | apps that expose their version over HTTP |
| **Entered by hand** | desktop apps, firmware, external services, anything without an endpoint |

With a URL it is read on **every check**. Accepted responses: plain text (`1.34.1`), a JSON string (`"1.34.1"`),
common keys such as `version`, or an explicit **JSON field** path such as `data.version` (empty = detect
automatically). **Test URL** shows the detected version and a preview of the response.

Examples:

| App | URL | JSON field |
| --- | --- | --- |
| Vaultwarden | `https://vault.lan/api/version` | – |
| ReleaseWatcher | `http://127.0.0.1:8080/api/version` | – |
| an app returning `{"data":{"version":"2.1.0"}}` | `https://app.lan/api/info` | `data.version` |

**Request headers** (e.g. `Authorization: Bearer …`, `X-Api-Key`) are stored encrypted and never returned by the API –
only their names. Leave a value empty to keep the saved one.

With a known installed version:

- the list shows *Update available 1.34.1 → 1.34.3*,
- releases you already run (installed ≥ release) are **not announced**,
- Discord messages include the installed version,
- the version is used for [[Vulnerabilities]] impact.

**Entered by hand:** type the version (e.g. `1.34.1`); it's kept until you change it. After upgrading, **Mark as
installed** sets it to the latest release in one click.

### Icon

By default a repository shows its owner's avatar – for apps published under a personal account that's the developer's
photo. Set **Icon** to:

- an image URL: `https://example.com/logo.svg`, or
- a [selfh.st/icons](https://selfh.st/icons/) name with the `sh:` prefix (like in Homepage or Homarr): `sh:frigate`,
  `sh:frigate-light`, `sh:frigate-dark`; `sh:<name>.png` picks a format,
- or click **Browse** for a searchable grid of all selfh.st icons with light and dark variants.

`sh:` names resolve to jsDelivr (`https://cdn.jsdelivr.net/gh/selfhst/icons/svg/<name>.svg`, then PNG and WebP). If the
icon can't be loaded, the owner's avatar is shown. The icon is also used:

- next to applications on the [[Machines]] page whose latest version comes from this repository,
- as the author icon in Discord – as PNG, because Discord shows no SVG (an SVG URL falls back to the avatar there).

The icon list for **Browse** is loaded by your browser from jsDelivr.

### GitHub tokens

A global token (**Settings → General → GitHub**, or `GITHUB_TOKEN`) is used for every repository. A repository can
have **its own token**, e.g. for a private repository of another user; it overrides the global one for that
repository. Tokens are encrypted at rest and shown only masked; **Remove it** deletes a repository token.

| Token | Permissions |
| --- | --- |
| Fine-grained | *Contents: Read-only*; *Repository security advisories: Read-only* for advisories of private repositories |
| Classic | `repo` (private) or none (public only) |

The remaining quota is shown in Settings (`GET /api/github/rate-limit`).

### Vulnerabilities from OSV.dev

*Ecosystem* + *Package* under which the app is published, e.g. `npm` / `n8n` or `Go` / `github.com/gitea/gitea`.
See [[Vulnerabilities]].

## Related

- [[Notifications]] – what is sent and how.
- [[Docker containers]] – containers can link themselves to a repository through labels.
- [[REST API]] – `/api/repositories`.
