# Machines

The **Machines** page lists everything watched over SSH, grouped by host when there is more than one:

| Kind | Added with | Commands run via |
| --- | --- | --- |
| **LXC container** | *Add* or **Add all** (found with `pct list`) | `pct exec` on the node |
| **Virtual machine** | *Add*, one by one (found with `qm list`) | QEMU guest agent (`qm guest exec`) |
| **Proxmox node** | **Add host** (the node itself, apt only) | SSH to the node |
| **Server** | **Add server** (or Settings → Connections → Add host → *Server*) | SSH to the server |

First set up a key and a host – [[Connections and SSH]]. The old `/containers` address redirects to `/machines`.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/containers-dark.png">
  <img src="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/containers-light.png" alt="Machines page" width="800">
</picture>

## What a check reads

One check is **one SSH connection**: status + one command with the package check and all version commands.

- **System packages** – with the package manager found on the machine (see [Supported systems](#supported-systems));
  switch *System packages* off for appliances without one.
- **Applications** – installed and latest version of each app ([[Applications and updates]]).
- **Restart needed** – see below.
- **Operating system** – `/etc/os-release` (+ Debian point release, and `pveversion` on the node), e.g.
  *Debian 12.8 (bookworm)* or *Proxmox VE 9.1.1 · Debian 13.2 (trixie)*. Informational only: release upgrades are not
  detected or run.
- **Docker / Podman containers** when the CLI is installed ([[Docker containers]]).
- **Home Assistant OS** in a VM ([[Home Assistant OS]]).

## Schedule

- Default `CONTAINER_CHECK_CRON` = `0 */6 * * *` (every 6 hours, server time zone).
- Each machine can override it (**Check schedule** in its settings).
- Up to `CONTAINER_CHECK_CONCURRENCY` (default 3) machines are checked in parallel.
- **Check** on a machine, or *check all* on the page, starts a check now.
- Schedulers **only check – they never update**.

## Machine settings

| Setting | Meaning |
| --- | --- |
| Name | display name |
| **Active (scheduled checks)** | off = no scheduled checks (manual still possible) |
| **System packages** | check and upgrade the system packages (apt, dnf, zypper, apk, pacman …) |
| **Docker containers** | list Docker/Podman containers during checks; off forgets them |
| **Check schedule** | cron; empty = global default |
| **Backup before updates** | default for this machine; empty = global (`BACKUP_BEFORE_UPDATE`) |
| **Start temporarily when stopped** | LXC/VM: start for checks and updates, shut down afterwards |
| **CPU cores / Memory during updates** | LXC: raise resources for updates, restore afterwards |
| Applications | see [[Applications and updates]] |
| Home Assistant URL / token / install | [[Home Assistant OS]] VMs only |

## LXC containers

- **Add containers** one by one or with **Add all** (adds every container of the node not added yet).
- **Stopped containers** are not started by default: a check only reads the status and keeps the last results; updates
  are refused. With **Start temporarily when stopped** checks and updates run `pct start`, wait for the network and
  shut the container down afterwards.

## Virtual machines

- Need the **QEMU guest agent**: install `qemu-guest-agent` in the VM and enable *QEMU Guest Agent* in the VM's
  Proxmox **Options**. No SSH server in the VM is needed.
- Checks, package upgrades, applications, backups, temporary starts (`qm start`, waiting up to 3 minutes for the agent) and
  restarts work like for containers.
- Differences: the output of an update appears when it has **finished** (the agent returns it at the end), and VMs are
  **not resized** for updates.
- Appliances without a package manager: switch *System packages* off.

```bash
# inside a Debian/Ubuntu VM
apt-get install -y qemu-guest-agent && systemctl enable --now qemu-guest-agent
# on the node (or in the UI: VM → Options → QEMU Guest Agent → Enabled), then restart the VM
qm set <vmid> --agent enabled=1
```

## The Proxmox node itself

- **Add host** on the Machines page adds the node (apt only).
- Upgraded with `apt-get dist-upgrade` + `apt-get autoremove`, as Proxmox VE requires.
- **No backup** before node upgrades and **never rebooted automatically**.

## Servers (VPS and other Linux machines)

Any Linux machine reachable over SSH ([supported systems](#supported-systems)), no Proxmox needed. **Add server** takes address, port, user and SSH key;
it is watched right away.

- Commands run directly on the server (`sh -lc` over SSH; a non-root user needs passwordless `sudo`).
- System packages are checked and upgraded with the server's package manager (apt: `apt-get upgrade`, not
  `dist-upgrade`), without a backup. Applications work like in containers.
- Servers without systemd (e.g. Alpine with OpenRC) work too: updates run in a session of their own (`setsid`) and
  are stopped at their timeout like a systemd unit.
- **Restart server** schedules `systemctl reboot`, waits until SSH answers again and checks it. It waits for running
  checks and updates of that server first.
- Removing the server on the Machines page also removes its host (and the other way round); the SSH key stays.

## Supported systems

The check finds the package manager by itself and shows its name on the machine ("apk", "dnf" …):

| Package manager | Systems | Check | Upgrade |
| --- | --- | --- | --- |
| apt | Debian, Ubuntu, Devuan, Proxmox VE | `apt-get update` + `apt list --upgradable` | `apt-get upgrade` + `autoremove` (node: `dist-upgrade`) |
| dnf / yum | Fedora, RHEL, Rocky, AlmaLinux, CentOS, Amazon Linux | `dnf check-update --refresh` (installed versions from `rpm`) | `dnf upgrade --refresh` / `yum update` |
| zypper | openSUSE Leap, Tumbleweed, SLES | `zypper refresh` + `zypper list-updates` | `zypper update` (Tumbleweed/Slowroll: `zypper dup`) |
| apk | Alpine | `apk update` + `apk version -l '<'` | `apk upgrade` |
| pacman | Arch, CachyOS, Manjaro, EndeavourOS | `pacman -Qu` against a copy of the sync databases (like `checkupdates`) | keyrings first, then `pacman -Su` |

All upgrades run without questions (`-y`, `--noconfirm`, `-n`). Machines without any of these (e.g. Gentoo, NixOS,
appliances) report *No supported package manager found* – switch *System packages* off and they are still watched for
applications, Docker containers and restarts. CentOS 7 and other end-of-life releases fail when their repositories are
offline.

## Restart needed

Every check also looks for:

- `/var/run/reboot-required` (with the packages that asked for it),
- in containers and VMs: processes still using executables or libraries replaced by an upgrade (like `needrestart`),
- on the node, in VMs and on servers: a running kernel older than the newest one in `/boot` (kernels named by flavour,
  like Alpine's `vmlinuz-lts`, are ignored).

The reasons are shown with a **Restart** button (after a confirmation):

| Target | Restart |
| --- | --- |
| LXC / VM | `pct reboot` / `qm reboot` (detached, so it also works for the container ReleaseWatcher runs in), then a check |
| Node | reboot scheduled 15 s later with `systemd-run`; refused while other checks or updates run |
| Server | reboot scheduled 15 s later (`systemd-run`, or `reboot` in its own session without systemd), wait for SSH, check |

**Restarts never happen automatically.**

## Page features

- Filters **All, Updates, Errors**; search; sort **Needs attention first / VMID / Name** (remembered per browser).
- Per machine: status (*Working*, *Stopped or paused*), pending apt packages (expand to see the list), applications,
  restart reasons, OS, last check, **Check**, **Update**, settings, run history.
- **Update** (page header): see [Updating several machines](Applications-and-updates#updating-several-machines).

## Next

→ [[Applications and updates]] · [[Home Assistant OS]] · [[Docker containers]]
