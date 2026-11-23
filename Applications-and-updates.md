# Applications and updates

Besides apt packages, every machine can have **applications**: software whose installed version ReleaseWatcher reads
and compares with the latest one, and which it can update with your command.

## Applications

Open a machine's settings → **Applications** → *Add*:

| Field | Meaning | Example |
| --- | --- | --- |
| **Name** | display name | `Vaultwarden` |
| **Version command** | runs inside the machine; the **first output line** is the installed version | `cat /opt/vaultwarden_version.txt` |
| **Installed version** | without a version command: the version you run, entered by hand | `1.34.1` |
| **Latest version from** | *A watched GitHub repository*, *A command*, or *Nothing (no comparison)* | `dani-garcia/vaultwarden` |
| **Latest version command** | with *A command*: prints the latest version | `curl -fsSL https://…/latest` |
| **Update command** | runs inside the machine to update the app | `update` |
| **Use a terminal (TTY)** | for scripts that need a terminal | – |
| **Timeout (s)** | the update is stopped after this time (default 1800 = 30 min) | `3600` |

- *Latest version from → A watched GitHub repository* needs the repository on the Repositories page first. The app then
  shows the repository's icon, its new releases trigger a check of this machine, and the app's installed version counts
  for the repository's [[Vulnerabilities]].
- Without a version command, **Mark as installed** sets the installed version to the latest one after you updated.
- Update commands run with `PHS_SILENT=1` and `DEBIAN_FRONTEND=noninteractive`, so the community-scripts `update`
  skips its menu.

### Typical update commands

| Setup | Update command |
| --- | --- |
| [community-scripts](https://community-scripts.github.io/ProxmoxVE/) LXC | `update` |
| your own script | `cd /opt/app && ./pull.sh` |
| Docker compose inside the machine | `cd /opt/app && docker compose pull && docker compose up -d` |

## Detect applications

**Detect applications** (machine settings, running machine only) looks inside and proposes apps:

- a community-scripts container (`/usr/bin/update` → `ct/<app>.sh`) with its version file,
- `/opt/*_version.txt` and version files of well-known applications.

The GitHub repository comes from a built-in list or from the `# Source:` line of the community-scripts script.
**Nothing is saved until you click Add**; *Hide found applications* hides the list.

## Running updates

**Updates are manual only.** Nothing is ever upgraded by a schedule.

| Action | What runs |
| --- | --- |
| **apt upgrade** (LXC, VM) | `apt-get -y upgrade` + `apt-get -y autoremove`, keeping existing config files |
| **apt upgrade** (Proxmox node) | `apt-get dist-upgrade` + `apt-get autoremove`, no backup |
| **apt upgrade** (server) | `apt-get upgrade` (not `dist-upgrade`), no backup |
| **Update** of an app | its update command |
| **Update all (n)** on a machine | apt first, then every app with an update; a failure skips the rest of that machine |

Every update asks for confirmation, with a **Backup first** checkbox where backups are possible. The console output is
shown live (VMs: at the end) and stored in the **run history**. Only **one task per machine** runs at a time.

### Updating several machines

**Update** in the Machines page header first shows checkboxes, with every machine that has pending updates ticked. A
second click updates the ticked machines **one after another** (apt first, then applications). The Proxmox node and
stopped containers that may not be started are left out.

## Backups before updates

1. Set the **backup storage** of each node (Settings → Connections → node → *Edit*), e.g. Proxmox Backup Server or
   `local`. No storage = no backups for its guests.
2. Choose a default in *Settings → General → Containers* (`BACKUP_BEFORE_UPDATE`); machines can override it.
3. Every confirmation has a **Backup first** checkbox.

The backup is a `vzdump` in **snapshot** mode (zstd, except on PBS); retention follows the storage's prune settings.
**A failed backup stops the update.** No backups for the node itself or for servers.

## Resources during updates

An LXC container can get more **CPU cores** and **memory** for its updates (e.g. one that compiles Rust). They are
raised with `pct set` right before the update and restored afterwards – also on failure or after a restart of
ReleaseWatcher (the original values are saved before the change). VMs are not resized.

## Resilient runs

Backups, upgrades and updates run on the node as **transient systemd units** (`releasewatcher-run-<run>-<step>`, output
in `/var/tmp/releasewatcher/`). The SSH connection only streams the output:

- a dropped connection is re-established and the output re-read,
- after a restart of ReleaseWatcher it re-attaches and finishes the run.

So you can even update the container ReleaseWatcher runs in – see [[Updating ReleaseWatcher]].

## Interactive prompts

> [!WARNING]
> Whiptail menus, `[y/N]` questions and dpkg config-file questions **cannot be answered from the UI**. An update that
> shows one and prints nothing for **45 seconds** is stopped with a message. Prefer non-interactive commands
> (`-y`, `--non-interactive`, env vars like `DEBIAN_FRONTEND=noninteractive`).

## Run history

Each machine keeps its runs (checks, updates, upgrades, restarts) with the output, newest first, loaded page by page.
*Settings → General → Containers → Run history per container* limits how many checks and how many other runs are kept
(1–500 each; empty = all). Output of finished runs is stored compressed.

## Related

[[Machines]] · [[Home Assistant OS]] · [[Notifications]] (*Application updates*, *Update finished/failed*)
