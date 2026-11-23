# First steps

You have ReleaseWatcher running ([[Installation]]). Open `http://<host>:8080`.

## 1. Create the account

On the first start the app writes a one-time **setup code** to its log and to `setup-code` next to the database:

| Install | Where to find the code |
| --- | --- |
| Docker | `docker logs releasewatcher 2>&1 \| grep setupCode` |
| Native / LXC | printed by `--install` / `bun run deploy`, or `cat /var/lib/releasewatcher/setup-code` |
| From source | console output, or `setup-code` next to `releasewatcher.db` |

Enter it with a user name and a password (at least 10 characters). There is exactly **one account**; nobody else can
claim a fresh installation without the code. Later you can add passkeys – see [[Account and security]].

## 2. Notifications

**Settings → Notifications**: add a Discord webhook and/or an SMTP server, then **Test**. Choose what is sent and
whether one check run sends a single summary. → [[Notifications]]

## 3. GitHub token (recommended)

**Settings → General → GitHub**: a personal access token raises the API limit from 60 to 5000 requests/hour and lets
you watch private repositories. A fine-grained token with *Contents: Read-only* is enough (plus *Repository security
advisories: Read-only* for advisories of private repositories). → [Repositories – GitHub tokens](Repositories#github-tokens)

## 4. Repositories

**Repositories**: type `owner/repo` or paste a GitHub URL and click **Watch**. A new database already watches
ReleaseWatcher itself, so you'll see when an update is out ([[Updating ReleaseWatcher]]).

The first check only stores the newest release as a **baseline** – you won't get a flood of old releases. Then set the
installed version and an icon in the repository settings. → [[Repositories]]

## 5. Machines (optional)

1. **Settings → Connections → SSH keys → Generate key**, copy the public key into `~/.ssh/authorized_keys` on your
   Proxmox node / server.
2. **Settings → Connections → Add host** – *Proxmox node* or *Server*, then **Test connection**.
3. **Machines** – add containers (or **Add all**), virtual machines, the node itself, servers.

→ [[Connections and SSH]], [[Machines]], [[Applications and updates]]

## 6. Docker (optional)

Containers on machines added over SSH are found automatically. For a Docker host without SSH, add a **Docker
endpoint** under Settings → Connections. → [[Docker containers]]

## 7. Make it yours

- **Settings → Appearance** – theme and accent colour ([[Appearance]]).
- **Account → API tokens** – a read-only token for your dashboard ([[API tokens]]).
- Set `TZ` so cron schedules follow your local time ([[Configuration]]).

## Tour of the UI

| Page | What's there |
| --- | --- |
| **Repositories** | watched repositories, latest/installed version, update and vulnerability badges; filters *All, Active, Paused, Updates, Vulnerable, Errors*; list or grid layout |
| **Vulnerabilities** | advisories of all repositories; filters *Affects installed, Unknown, Not affected, All* |
| **Machines** | containers, VMs, nodes and servers with apt/app updates; filters *All, Updates, Errors*, sort *Needs attention first / VMID / Name* |
| **Docker** | containers of machines and endpoints, grouped by compose project; filters *All, Updates, Version unknown* |
| **Settings** | tabs *General, Connections, Notifications, Appearance* |
| **Account** | user name, password, passkeys, sessions, API tokens |

The sidebar shows counters, the state of the scheduled checks and **Check all now**.
