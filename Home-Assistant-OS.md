# Home Assistant OS

A **Home Assistant OS** virtual machine on a Proxmox node is recognised automatically by every check
(`ID=haos` in `/etc/os-release`). apt is then switched off and ReleaseWatcher shows Home Assistant's own updates.

## Requirements

- The VM is added on the [[Machines]] page (virtual machines are added one by one).
- *QEMU Guest Agent* enabled in the VM's Proxmox options (HAOS ships the agent).

## What is read

| Update | How |
| --- | --- |
| **Core**, **Operating System**, **Supervisor**, **apps** (add-ons) | live with the `ha` CLI on the HAOS host |
| **Integrations** (update entities, e.g. from the built-in marketplace, formerly HACS) | without a token or with a token – see below |

### Without a token

Integration updates are read from `core.restore_state`, which Home Assistant saves every **15 minutes** – the UI shows
how old it is.

### With a long-lived access token (live)

1. In Home Assistant: *Profile → Security → Long-lived access tokens → Create token*.
2. In the VM's settings in ReleaseWatcher: **Home Assistant URL** (e.g. `http://192.168.1.60:8123`) and
   **Long-lived access token**.

Updates are then read live from the REST API (`GET /api/states`). The token is stored encrypted and sent only from
ReleaseWatcher to that URL – **never to the Proxmox node**. Home Assistant tokens cannot be limited to reading – create
the token for a **user without administrator rights** to keep it small.

## Installing updates

By default updates are **only checked and reported** – install them in Home Assistant.

With **Install Home Assistant updates from ReleaseWatcher** switched on in the VM settings:

| Update | Command |
| --- | --- |
| Core | `ha core update` |
| Supervisor | `ha supervisor update` |
| Apps | `ha apps update <slug>` |
| Integrations | `update.install` through the API – **needs the token**; Core is restarted afterwards for custom integrations |
| Operating System | never – it restarts the VM; always left to Home Assistant |

You can install all installable updates at once or pick some; **Backup first** makes a `vzdump` of the VM like for any
other update ([[Applications and updates]]).

## API

`POST /api/containers/:id/home-assistant-update` with `{ "backup"?, "ids"? }` – see [[REST API]].
