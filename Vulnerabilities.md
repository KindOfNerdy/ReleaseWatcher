# Vulnerabilities

ReleaseWatcher reads known vulnerabilities of every watched repository and tells you which ones affect the version
**you actually run**.

## Sources

Switch them on or off in **Settings → General → Vulnerability sources** (both on by default):

| Source | What it reads | Setup |
| --- | --- | --- |
| **GitHub security advisories** | GHSA entries maintainers publish under *Security → Advisories* of the repository (with ETags and the same token as releases) | none |
| **OSV.dev** | the [OSV](https://osv.dev) database (GitHub, Go, PyPI, RustSec, npm… with CVE aliases) for the package the app is published as | repository settings → *Vulnerabilities from OSV.dev*: **Ecosystem** + **Package** |

OSV.dev examples:

| App | Ecosystem | Package |
| --- | --- | --- |
| n8n | `npm` | `n8n` |
| Gitea | `Go` | `github.com/gitea/gitea` |

Look the package up on [osv.dev](https://osv.dev) first – the ecosystem and name must match OSV exactly.

- Entries reported by both sources (same GHSA/CVE id) are listed once.
- Withdrawn entries are dropped; switching a source off removes its entries.
- Private repositories: the token needs *Repository security advisories: Read-only*.

## Schedule

- `ADVISORY_CHECK_CRON` (default `0 */6 * * *` – every 6 hours), editable in *Settings → General → Check schedules*.
- On the first check of a new repository, and on every manual **Check** of a repository.
- Runs missed while the app was stopped are caught up shortly after a start.
- A failed read is shown on the repository (per source) and never marks the release check as failed.

## Impact on your installation

The vulnerable range (e.g. `>= 1.0.0, < 1.32.1`) is compared with **all installed versions** of the repository:

- the repository's own installed version (URL or entered by hand – [[Repositories]]),
- every machine application linked to the repository (*latest version from* this repository –
  [[Applications and updates]]),
- every Docker container linked to it ([[Docker containers]]).

| Impact | Meaning |
| --- | --- |
| **Affects installed** | at least one installed version is in range |
| **Not affected** | all installed versions are outside the range |
| **Unknown** | no installed version known (*Installed version unknown*) |

Range notations understood: `>= 1.0.0, < 1.32.1`, `>= 2.0.0 && <= 2.1.3`, `1.23.0 - 1.23.15`, lists
(`2.0.0-beta.0, 2.0.0-beta.1`) and `*`. An open range (`>= 0.104.0`) is capped by the patched version (`0.135.0` →
`>= 0.104.0, < 0.135.0`), so newer versions are not flagged.

## Vulnerabilities page

- Lists the vulnerabilities of all repositories: affecting an installed version first, then most severe, newest.
- Severity, CVSS score, ids (GHSA, CVE), vulnerable and patched versions, source.
- Filters: **Affects installed, Unknown, Not affected, All**, severity, source, and a search (summary, ids, aliases,
  repository).
- Opens on *Affects installed* (or *All* when nothing affects an installed version). Long lists load more as you scroll.
- The sidebar counter shows how many affect an installed version.

On the Repositories page, each repository shows a red *N vulnerabilities affect installed* or grey *N advisories*
badge that opens its list; the **Vulnerable** filter shows only those.

## Notifications

As with releases, the first read of each source (and of a newly set OSV.dev package) only stores a **baseline**.
Vulnerabilities published later are sent as *New vulnerabilities* (max 5 per check) unless the installed version is
known not to be affected. See [[Notifications]].

## API

`GET /api/advisories` (paged, filters) and `GET /api/repositories/:id/advisories` – see [[REST API]].
