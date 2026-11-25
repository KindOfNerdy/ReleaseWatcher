<p align="center">
  <img src="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/logo.svg" width="88" height="88" alt="ReleaseWatcher logo">
</p>

# ReleaseWatcher

**Self-hosted release tracker for your homelab.** ReleaseWatcher tells you when the GitHub projects you run publish a
new release or a security advisory, and keeps the system packages and applications of your Proxmox containers, virtual
machines, servers and Docker containers up to date – from one small app with one SQLite file.

This wiki is the user guide. The [README](https://github.com/Rozumek29/ReleaseWatcher#readme) is the short overview;
contributor rules live in [`AGENTS.md`](https://github.com/Rozumek29/ReleaseWatcher/blob/main/AGENTS.md) and
[`DESIGN.md`](https://github.com/Rozumek29/ReleaseWatcher/blob/main/DESIGN.md).

> Documentation for **ReleaseWatcher 1.5.0** (current `main`).

## Start here

| I want to… | Read |
| --- | --- |
| Install it | [[Installation]] → [[First steps]] |
| Update ReleaseWatcher itself | [[Updating ReleaseWatcher]] |
| Get a Discord, e-mail, ntfy, Telegram … message for new releases | [[Repositories]], [[Notifications]] |
| Watch a project without releases (tags, a web page, an RSS feed) | [[Repositories]], [[Web pages and feeds]] |
| See which vulnerabilities affect what I run | [[Vulnerabilities]] |
| Keep Proxmox containers, VMs and servers updated | [[Connections and SSH]] → [[Machines]] → [[Applications and updates]] |
| Track Home Assistant OS updates | [[Home Assistant OS]] |
| Track Docker / Podman containers | [[Docker containers]] |
| Change colours and theme | [[Appearance]] |
| Set up passkeys, single sign-on or a token for Homepage | [[Account and security]], [[API tokens]] |
| Script against it | [[REST API]] |
| Tune it with environment variables | [[Configuration]] |
| Fix a problem | [[Troubleshooting]], [[FAQ]] |
| Hack on the code | [[Development]] |

## What it does

**GitHub releases**

- Watches any public or private repository; pre-releases are opt-in per repository.
- Projects without releases: their **tags** (newest by version, with an optional version pattern like `^TS-(.+)$`), or a
  **web page, RSS/Atom feed or JSON API**.
- Knows the **installed version** of your instance (read from a URL like `/api/version`, or entered by hand), so it
  shows *Update available 1.34.1 → 1.34.3* and does not announce releases you already run.
- Custom **icons** (an image URL or a [selfh.st/icons](https://selfh.st/icons/) name like `sh:frigate`).
- Rate-limit friendly: ETag requests, optional GitHub token (global or per repository).

**Vulnerabilities**

- GitHub security advisories and **OSV.dev**, matched against your installed versions.

**Machines (over SSH)**

- Proxmox LXC containers, virtual machines (via the QEMU guest agent), the Proxmox node itself and plain Linux
  servers: pending **system packages** (apt, dnf/yum, zypper, apk, pacman), **application** versions, *restart needed* hints, OS version.
- One-click updates with live console output, optional `vzdump` backup first, temporary CPU/RAM boost.
  **Updates never run automatically.**
- **Home Assistant OS** VMs: Core, OS, Supervisor, apps and integrations.

**Docker and Podman**

- Containers on your machines and on Docker endpoints (socket proxy, socket, remote engine): installed version,
  *New image* when the registry digest changed, links to watched repositories. Read-only.

**App**

- One executable (or Docker image), one SQLite file, no external services.
- Password and/or **passkeys**, **API tokens**, secrets encrypted at rest (AES-256-GCM).
- Light/dark themes and accent colours; every setting can be changed in the UI without a restart.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/repositories-dark.png">
  <img src="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/repositories-light.png" alt="Repositories page" width="900">
</picture>

## How the pieces fit

```
Browser (Angular UI) ──HTTP──▶ ReleaseWatcher (one Bun process, one SQLite file)
                                 ├─ release checks ───────▶ GitHub API (ETag)
                                 ├─ vulnerability checks ─▶ GitHub advisories, OSV.dev
                                 ├─ machine checks ───────▶ SSH ─▶ Proxmox node (pct / qm) · servers
                                 ├─ Docker checks ────────▶ Docker endpoints · registries (HEAD)
                                 └─ notifications ────────▶ Discord · SMTP · ntfy · Gotify · Telegram · Slack · Pushover · webhook
```

Every schedule is a cron expression in the server's time zone. See [[Configuration]].
