# FAQ

### Does ReleaseWatcher update anything automatically?

**No.** Schedules only *check*. apt upgrades, application updates, Home Assistant updates and restarts always start
from a click (or an API call with a full-access token). Docker containers are never touched at all.

### Do my containers or VMs need an SSH server?

No. ReleaseWatcher connects to the **Proxmox node** only and reaches guests with `pct exec` (LXC) or the QEMU guest
agent (VMs). Only plain servers are reached over SSH directly. See [[Connections and SSH]].

### Does it work without Proxmox?

Yes. Release and vulnerability tracking need nothing but GitHub. Debian/Ubuntu servers can be added as *Server* hosts,
and Docker hosts as Docker endpoints.

### Which distributions are supported on machines?

apt-based ones (Debian, Ubuntu, Proxmox VE). Machines without apt can still be watched for applications and Docker
containers with *apt packages* switched off – e.g. Alpine containers or appliances.

### Is GitLab / Gitea / Codeberg supported?

Not yet – releases come from the GitHub API. For apps hosted elsewhere you can still track the installed version on a
machine with *Latest version from → A command*.

### Can I use Slack, Telegram, ntfy, Gotify…?

Built in are Discord and e-mail. Many services accept e-mail or Discord-compatible webhooks; otherwise a new notifier is
a small piece of code ([[Development]]).

### How many GitHub API requests does it use?

One per repository per check, minus ETag hits (a `304` is free). Advisories cost one more per repository on their own
schedule. With 30 repositories every 15 minutes you need a token. See [[Configuration]].

### Why didn't I get notifications for old releases?

The first check stores a **baseline**; only releases published after it are announced. Same for vulnerabilities.

### Can several people use it?

There is one account. Several people can share it, each with their own passkey. Read-only access for tools goes
through [[API tokens]].

### Is it safe to expose to the internet?

It can run root commands on your machines, so prefer a VPN or LAN-only access. If you expose it: HTTPS, `PUBLIC_URL`,
passkeys only, and read-only tokens for dashboards. See [[Account and security]].

### Where is my data, and how do I back it up?

One SQLite database plus `encryption.key`, `known_hosts` and (briefly) `setup-code` in the data directory (`/data` in
Docker, `/var/lib/releasewatcher` natively). Back up the whole directory with the service stopped, and keep a copy of
the encryption key. See [[Updating ReleaseWatcher]].

### Can I move ReleaseWatcher to another machine?

Yes: stop it, copy the data directory (including `encryption.key`) and the configuration, start the new instance with
the same `ENCRYPTION_KEY` if you used one. If the IP changes, update `from="…"` restrictions in `authorized_keys`.
`bun run deploy -- --db` / `--force-db` copies a local database into an LXC.

### Does it run on a Raspberry Pi?

On a 64-bit OS, yes (`linux/arm64` image or the `linux-arm64` release). 32-bit ARM is not supported.

### How much does it need?

1 CPU, 512 MB RAM, 2 GB disk is plenty. The executable is about 110 MB unpacked (mostly the Bun runtime).

### Can I change the colours?

Yes – theme and accent colour per browser: [[Appearance]].

### How do I know a new ReleaseWatcher version is out?

It watches its own repository by default. See [[Updating ReleaseWatcher]].

### How do I show updates in Homepage?

With a read-only API token and the `customapi` widget – example in [[API tokens]].
