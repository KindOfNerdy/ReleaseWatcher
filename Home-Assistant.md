# Home Assistant

ReleaseWatcher reads what is installed in a **Home Assistant** instance – Core, integrations, cards and other
components whose update entity names a repository – and shows it on the **Home Assistant** page.
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

## What you see per component

- **Installed version** and, when Home Assistant reports an update, the version it offers.
- **Update available** opens the release Home Assistant links to; **Up to date** otherwise.
- **Commit** – the installed version is a commit hash (a repository without releases). It is shown, but cannot be
  compared with releases.

The filter **Updates** shows only components with an update. When a connection cannot be read, its error is shown and
the components read before are kept.

## Backup

Connections are not part of an exported [[Configuration]] backup – a connection is of no use without its token. The
export lists them under the secrets it left out; add them again after an import.

## API

`GET /api/home-assistant` and `/api/home-assistant/connections…` – see [[REST API]].
