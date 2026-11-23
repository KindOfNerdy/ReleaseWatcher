# Updating ReleaseWatcher

## How you learn about a new version

Every new database already watches ReleaseWatcher's own repository, `rozumek29/releasewatcher`:

- stable releases only,
- with this server's own `/api/version` (e.g. `http://127.0.0.1:8080/api/version`) as the installed-version URL.

So the Repositories page shows *Update available 1.5.0 → 1.6.0* for ReleaseWatcher itself, and the release is sent to
your [[Notifications]] channels like any other. If you remove the repository it is **not** added again.

You can always check the running version:

- the sidebar / `GET /api/status` (`version`),
- `GET /api/version` (public, no login) → `{ "version": "1.5.0" }`,
- `releasewatcher --version` (or `-v`) on a native install.

> ReleaseWatcher does not replace its own executable from the UI – you run the update with the method you installed
> it with (below). It takes a few seconds and keeps all data.

## Before you update

- Migrations run automatically on start and are append-only: an update never needs manual SQL.
- For a rollback you need the **old executable / image** and a **copy of the data directory** taken before the
  update (an older version may not understand a newer database).
- Back up `encryption.key` (or keep your `ENCRYPTION_KEY`) – without it the app refuses to start on that database.

What to back up:

| Install | Data |
| --- | --- |
| Docker | the `/data` volume |
| Native / LXC | `/var/lib/releasewatcher` and `/etc/releasewatcher` |

SQLite runs in WAL mode: stop the service first, or copy **all** `releasewatcher.db*` files together. On Proxmox a
`vzdump` / PBS backup of the LXC covers everything.

## Docker

```bash
docker compose pull && docker compose up -d
# or
docker pull ghcr.io/rozumek29/releasewatcher:latest
docker rm -f releasewatcher && docker run -d … (same command as before)
```

With a minor tag (`1.5`) you get patch releases only; switch the tag for the next minor. A pinned tag (`1.5.0`)
never changes. Rollback: run the previous tag with the backed-up volume.

Tip: since ReleaseWatcher also watches Docker containers, its own container shows *New image* when `latest` moved – see
[[Docker containers]].

## Native install (`--install`)

Download the new release and run `--install` again – exactly like the first install:

```bash
wget https://github.com/rozumek29/releasewatcher/releases/download/v<new>/releasewatcher-<new>-linux-x64.tar.xz
tar -xJf releasewatcher-<new>-linux-x64.tar.xz
./releasewatcher-<new>-linux-x64 --install
```

It replaces `/opt/releasewatcher/releasewatcher` (the old one is kept as `releasewatcher.previous`), refreshes the
systemd unit and restarts the service. Configuration, account and data stay.

Alternatively replace `/opt/releasewatcher/releasewatcher` by hand and `systemctl restart releasewatcher`.

**Rollback:**

```bash
systemctl stop releasewatcher
cp /opt/releasewatcher/releasewatcher.previous /opt/releasewatcher/releasewatcher
# restore /var/lib/releasewatcher from the backup if the new version migrated the database
systemctl start releasewatcher
```

## Proxmox LXC (`bun run deploy`)

From your clone of the repository:

```bash
git pull
bun install
bun run deploy -- --ct 251
```

Same result as `--install`: the previous executable is kept as `releasewatcher.previous`.

## Update ReleaseWatcher from the Machines page

If ReleaseWatcher runs in an LXC you also watch, you can let it update itself like any other application:

1. On **Machines**, open the container's settings → **Applications → Add**.
2. *Version command*: `/opt/releasewatcher/releasewatcher --version`.
3. *Latest version from*: the watched GitHub repository `rozumek29/releasewatcher`.
4. *Update command*: your own script that downloads the new release and runs `--install`, for example:

   ```sh
   set -e
   v=$(curl -fsSL https://api.github.com/repos/rozumek29/releasewatcher/releases/latest | sed -n 's/.*"tag_name": *"v\{0,1\}\([^"]*\)".*/\1/p')
   cd /tmp
   curl -fsSLO "https://github.com/rozumek29/releasewatcher/releases/download/v$v/releasewatcher-$v-linux-x64.tar.xz"
   tar -xJf "releasewatcher-$v-linux-x64.tar.xz"
   "./releasewatcher-$v-linux-x64" --install
   ```

Updates run as transient systemd units on the node, so the run survives the restart of ReleaseWatcher and is picked
up again when it is back. See [[Applications and updates]].

> [!NOTE]
> The script above is an example – adapt the file name for `-baseline` or `arm64` builds and test it once by hand.

## Release channels

| Tag pushed | GitHub release | Docker |
| --- | --- | --- |
| `v1.2.3` | release with `.tar.xz` (x64, x64-baseline, arm64) and `.zip` | `1.2.3`, `1.2`, `latest` (+ `-baseline`) |
| `beta-1.2.3` | pre-release with the same files | `beta-1.2.3` (+ `-baseline`) |

To be told about betas too, switch on *Pre-releases* for the `rozumek29/releasewatcher` repository.
