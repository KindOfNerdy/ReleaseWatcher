# Installation

ReleaseWatcher is a single self-contained executable (Bun runtime + UI embedded) or a Docker image. It stores
everything in one SQLite file plus a few files next to it. Pick one method:

| Method | Best for | Needs |
| --- | --- | --- |
| [Docker](#docker) | any Docker host, NAS | Docker |
| [Proxmox LXC – `bun run deploy`](#proxmox-lxc-one-command) | a dedicated LXC, installed from your computer | Bun + SSH access to the node |
| [Native – `releasewatcher --install`](#native-install-systemd) | any Linux x64 / arm64 machine with systemd | nothing – one executable |
| [From source](#from-source) | trying it out, development | Bun 1.4.4+, Node.js 26 |

A Debian/Ubuntu LXC with **1 CPU, 512 MB RAM and 2 GB disk** is plenty.

After installing, continue with [[First steps]]. To update later, see [[Updating ReleaseWatcher]].

## Which build for my CPU?

| Platform | Docker tag | Release file |
| --- | --- | --- |
| x64 with AVX2 (Intel Haswell / AMD Excavator, ~2013, or newer) | `latest`, `1.5`, `1.5.0` | `releasewatcher-<v>-linux-x64.tar.xz` |
| older x64 without AVX2 | `…-baseline` (`latest-baseline`) | `releasewatcher-<v>-linux-x64-baseline.tar.xz` |
| 64-bit ARM (Raspberry Pi 4/5 with a 64-bit OS, ARM cloud) | same tags (multi-platform) | `releasewatcher-<v>-linux-arm64.tar.xz` |
| 32-bit ARM | not supported (Bun has no runtime for it) | – |

Check a host with `grep -o -m1 avx2 /proc/cpuinfo` – no output means: use the `-baseline` build. A wrong build exits
with `Illegal instruction (core dumped)`.

## Docker

Images: `ghcr.io/rozumek29/releasewatcher`.

| Tag | Example | Updated on |
| --- | --- | --- |
| `latest` | – | every stable release |
| `<major>.<minor>` | `1.5` | every patch release of that line |
| `<version>` | `1.5.0` | never (pinned) |
| `beta-<version>` | `beta-1.5.0` | pre-releases only |

Every tag also exists with a `-baseline` suffix (`linux/amd64` only).

### docker run

```bash
docker run -d --name releasewatcher --restart unless-stopped \
  -p 8080:8080 -v releasewatcher-data:/data \
  ghcr.io/rozumek29/releasewatcher:latest

docker logs releasewatcher 2>&1 | grep setupCode    # one-time code to create your account
```

### docker compose

```yaml
services:
  releasewatcher:
    image: ghcr.io/rozumek29/releasewatcher:1.5
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - releasewatcher-data:/data   # database, encryption key, known_hosts, setup code
    environment:
      TZ: Europe/Warsaw             # time zone of the cron schedules
    env_file:
      - path: .env                  # optional – everything can be set in the UI
        required: false

volumes:
  releasewatcher-data:
```

- The image runs the compiled executable as an **unprivileged user** on `debian:trixie-slim` with the OpenSSH client
  (used to reach Proxmox nodes and servers).
- Everything that must survive an update lives in `/data`: `releasewatcher.db*`, `encryption.key`, `known_hosts`,
  `setup-code` (and `releasewatcher.log` if you enable `LOG_FILE`).
- The repository's own `docker-compose.yml` builds the image from source (`docker compose up -d --build`).
- If the package is private, log in first: `docker login ghcr.io` with a GitHub token that has `read:packages`.

To also watch the Docker containers of the same host, add a socket proxy – see [[Docker containers]].

## Proxmox LXC (one command)

From a clone of the repository on your computer. Needs SSH access to the Proxmox node and a **running Debian/Ubuntu
LXC with *Nesting* enabled** (Proxmox's default for new containers).

```bash
git clone https://github.com/Rozumek29/ReleaseWatcher.git && cd ReleaseWatcher
bun install
bun run deploy -- --ct 251            # first install and every later update
```

It builds the executable, uploads it through the node (`pct push`) and runs `deploy/install.sh` inside the container:
system user, directories, systemd service and `/etc/releasewatcher/releasewatcher.env`. The first install prints the
**setup code**. Running it again updates the app (the previous executable is kept as `releasewatcher.previous`);
configuration, account and data stay.

| Option | Description |
| --- | --- |
| `--ct <vmid>` | the target container |
| `--node <host>`, `--user`, `--port` | the node to connect to; default: the Proxmox host in **Settings → Connections** of your local instance |
| `--identity <key file>` | SSH key for the node; default: your normal ssh setup (`~/.ssh`, agent, `~/.ssh/config`). On Windows the system OpenSSH client is used, so keys in the Windows ssh-agent work |
| `--db` | also copy your local database when the container has none yet |
| `--force-db` | replace an existing database in the container |
| `--baseline` | build for older x64 CPUs without AVX2 |
| `--arm64` | build for a 64-bit ARM node |

## Native install (systemd)

As root on the target machine (or copy the archive into a container first, e.g.
`pct push <ct> <file> /root/<file>` on the Proxmox node):

```bash
wget https://github.com/rozumek29/releasewatcher/releases/download/v1.5.0/releasewatcher-1.5.0-linux-x64.tar.xz
tar -xJf releasewatcher-1.5.0-linux-x64.tar.xz   # needs xz-utils
./releasewatcher-1.5.0-linux-x64 --install
```

`--install` runs the embedded `deploy/install.sh`. It:

1. installs the OpenSSH client if missing,
2. creates the system user `releasewatcher`,
3. copies itself to `/opt/releasewatcher/releasewatcher`,
4. writes `/etc/systemd/system/releasewatcher.service` and the configuration template
   `/etc/releasewatcher/releasewatcher.env`,
5. starts the service and prints the address and the **setup code**.

The downloaded file can be deleted afterwards.

| Path | Contents |
| --- | --- |
| `/opt/releasewatcher/releasewatcher` | executable (`releasewatcher.previous` = the one before the last update) |
| `/etc/releasewatcher/releasewatcher.env` | environment variables ([[Configuration]]) |
| `/var/lib/releasewatcher/` | database, `encryption.key`, `known_hosts`, `setup-code` |
| `/var/log/releasewatcher/` | log file, if `LOG_FILE` is set (the only writable log directory of the unit) |

Useful commands:

```bash
systemctl status releasewatcher
journalctl -u releasewatcher -f            # JSON lines
/opt/releasewatcher/releasewatcher --version
```

### Uninstall

```bash
/opt/releasewatcher/releasewatcher --uninstall          # keeps /var/lib/releasewatcher and /etc/releasewatcher
/opt/releasewatcher/releasewatcher --uninstall --purge  # also removes data, configuration, logs and the user
```

### Step by step without `--install`

```bash
# 1. Dependencies (the OpenSSH client reaches the Proxmox node)
apt-get update && apt-get install -y openssh-client ca-certificates

# 2. System user and directories
useradd --system --home-dir /var/lib/releasewatcher --shell /usr/sbin/nologin releasewatcher
install -d -o releasewatcher -g releasewatcher -m 750 /var/lib/releasewatcher   # database + known_hosts
install -d -m 755 /opt/releasewatcher                                           # executable
install -d -o root -g releasewatcher -m 750 /etc/releasewatcher                 # configuration

# 3. Executable from the GitHub release
gh release download v1.5.0 -R rozumek29/releasewatcher -p 'releasewatcher-*-linux-x64.tar.xz'
tar -xJf releasewatcher-1.5.0-linux-x64.tar.xz
install -m 755 releasewatcher-1.5.0-linux-x64 /opt/releasewatcher/releasewatcher

# 4. Configuration (optional – everything can be set in the UI)
install -m 640 -g releasewatcher .env.example /etc/releasewatcher/releasewatcher.env

# 5. Service (deploy/releasewatcher.service from the repository)
install -m 644 releasewatcher.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now releasewatcher
cat /var/lib/releasewatcher/setup-code
```

> [!NOTE]
> The unit is hardened (unprivileged user, `ProtectSystem=strict`). In an unprivileged LXC this needs *Nesting*; if the
> service fails with `status=226/NAMESPACE`, enable *Options → Features → Nesting* or remove the hardening lines.

## From source

```bash
git clone https://github.com/Rozumek29/ReleaseWatcher.git && cd ReleaseWatcher
bun install
bun start            # builds the UI if missing or outdated, serves on http://localhost:8080
```

The release `releasewatcher-<version>.zip` contains sources, the production UI and runtime dependencies for an
installed Bun (`bun start`, no `bun install` needed). See [[Development]] for the dev server.

## Reverse proxy and HTTPS

Plain HTTP is fine on a trusted LAN, but **passkeys need HTTPS with a host name** and passwords should not travel in
clear text. Put ReleaseWatcher behind Caddy, Nginx Proxy Manager, Traefik… and set:

```dotenv
PUBLIC_URL=https://watcher.example.com
TRUST_PROXY=true      # only if the proxy sets X-Forwarded-For
```

`PUBLIC_URL` pins the allowed origin and the passkey relying party, and Discord container notifications link to it.
A minimal Caddyfile:

```caddyfile
watcher.example.com {
  reverse_proxy 192.168.1.50:8080
}
```

> [!CAUTION]
> The UI can run commands as root on your Proxmox node. Keep it on a private network or behind HTTPS.
> See [[Account and security]].

## Next

→ [[First steps]]
