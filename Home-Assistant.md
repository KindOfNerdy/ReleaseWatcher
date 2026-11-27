# Home Assistant

ReleaseWatcher reads what is installed in a **Home Assistant** instance – Core, integrations, cards and other
components whose update entity names a repository – shows it on the **Home Assistant** page and uses it as the
installed version of the repositories you watch.
**It is read-only: nothing is installed or changed in Home Assistant.**

It works with any installation (Home Assistant OS, Container, Supervised, Core) because it only needs the address and
a token. A Home Assistant OS virtual machine on a Proxmox node is covered by [[Home Assistant OS]] as well.

## Add a connection

1. In Home Assistant: *Profile → Security → Long-lived access tokens → Create token*.
2. In ReleaseWatcher: **Settings → Connections → Home Assistant → Add connection** – the address
   (e.g. `http://homeassistant.local:8123`), the token and an optional name. **Test connection** reads Home Assistant
   without saving and shows how many update entities name a repository.

> Home Assistant tokens cannot be limited to reading – create the token for a **user without administrator rights**.

The token is stored encrypted, shown only masked and sent only to the address it was saved for: when you change the
address of a connection, enter the token again.

Connections are read on `HOME_ASSISTANT_CHECK_CRON` (default `0 */6 * * *`, **Settings → General → Check schedules**)
and with **Check now** on the page. Switch **Check on schedule** off in a connection to pause it.

## What is read

Per connection: `GET /api/config`, then `GET /api/states`. While Home Assistant is still starting (its state is not
`RUNNING`), nothing is stored and the components read before are kept – the integrations and their update entities are
not loaded yet then. Every `update.*` entity whose `release_url` names a repository becomes
a component with its installed version, the newest version Home Assistant knows of and whether Home Assistant reports
an update (its state is `on` – a newer pre-release or a skipped version is no update).

| Entity | Repository |
| --- | --- |
| `release_url` is a GitHub repository or one of its releases (`https://github.com/owner/name/releases/tag/v1.2.3`) | `owner/name` |
| `release_url` is a release on Gitea/Forgejo or GitLab (`https://codeberg.org/owner/name/releases/tag/v1.2.3`) | `host/owner/name` |
| Home Assistant Core | `home-assistant/core` |

Left out:

- entities without a link – mostly device firmware,
- links to a file in a repository – blueprints and add-ons from a collection repository (their version is not a
  release of that repository),
- release notes pages and gists.

## Repository link

A component belongs to the repository its update entity names – there is nothing to set:

- When that repository is **watched**, the component is linked to it. It shows *Update available* for newer releases
  of the repository, and its installed version counts for the repository's [[Vulnerabilities]].
- When it is not watched yet, **Watch** adds it to the watch list. Nothing is added on its own – use the filter
  **Not watched** to go through the suggestions.

### Installed version of the repository

A watched repository reads its **installed version** from the component: after every check, and when you add the
repository, the version Home Assistant reports is taken over – unless the repository already has a version URL or
reads its version from an app on a machine or a Docker container. In the repository's settings the component is
listed under *Installed version from*, where you can stop or choose it again.

- A commit hash is never taken over (it cannot be compared with releases).
- When the component disappears, its connection is removed or the entity names another repository, the repository
  keeps the last version as entered by hand and says why.

## What you see per component

- **Installed version** and, when there is a newer one, the version an update would bring: the latest release of the
  watched repository, otherwise the version Home Assistant knows of.
- **Update available** – for a repository that is not watched it opens the release Home Assistant links to;
  **Up to date** otherwise.
- **Commit** – the installed version is a commit hash (a repository without releases). It is shown, but cannot be
  compared with releases.

Filters: **Updates**, **Not watched**, and a search over component and repository names. The sidebar shows the number
of components with an update. When a connection cannot be read, its error is shown and the components read before are
kept.

## Backup

Connections are not part of an exported [[Configuration]] backup – a connection is of no use without its token. The
export lists them under the secrets it left out; add them again after an import.

## API

`GET /api/home-assistant` and `/api/home-assistant/connections…` – see [[REST API]].
