# Troubleshooting

First look at the **logs** – JSON lines, one event per line:

| Install | Command |
| --- | --- |
| Docker | `docker logs -f releasewatcher` |
| Native / LXC | `journalctl -u releasewatcher -f` |
| File | set `LOG_FILE` ([[Configuration]]) |

For more detail set `LOG_LEVEL=debug` and restart. Machine checks and updates also keep their full console output in
the **run history** of each machine.

## Start-up

### `Illegal instruction (core dumped)`

The CPU has no AVX2. Use the `-baseline` Docker tag (`latest-baseline`) or the `…-linux-x64-baseline.tar.xz` release
(`bun run deploy -- --baseline`). Check: `grep -o -m1 avx2 /proc/cpuinfo` – no output = baseline. See
[[Installation]].

### systemd: `status=226/NAMESPACE`

The hardened unit needs *Nesting* in an unprivileged LXC: *Proxmox → container → Options → Features → Nesting*, then
restart the container. Or remove the hardening lines from the unit.

### The app refuses to start: encryption key

The database contains secrets encrypted with a different key. Restore the original `encryption.key` next to the
database, or set the original `ENCRYPTION_KEY`. Without the key the encrypted secrets cannot be recovered – see
[[Account and security]].

### Docker: permission denied on `/data`

The image runs as UID/GID `65532`. A bind-mounted directory must be writable by it:
`chown -R 65532:65532 ./data`. Named volumes work out of the box.

### Where is the setup code?

`docker logs releasewatcher 2>&1 | grep setupCode`, or the file `setup-code` next to the database
(`/data/setup-code`, `/var/lib/releasewatcher/setup-code`). It exists only while no account exists.

## Login

### Forgot the password / lost all passkeys

Use `--reset-login` – see [Reset the login](Account-and-security#reset-the-login).

### "Too many attempts" (`429`)

Repeated failed logins lock the client out with growing delays – wait and try again. Behind a reverse proxy without
`TRUST_PROXY=true` all clients share the proxy's IP and the lockout hits everyone.

### Passkeys: "not allowed" / no prompt

Passkeys need HTTPS with a host name (or `localhost`). Set `PUBLIC_URL` to the exact address you open in the browser.
Passkeys created under another host name don't work after changing `PUBLIC_URL`.

### `403 Cross-site request refused.` behind a proxy

State-changing requests whose `Origin` is not this site are refused. Make sure `PUBLIC_URL` matches the address in the browser
(scheme, host and port) and that the proxy passes the `Host` header through.

## Repositories

### GitHub rate limit exceeded

Without a token GitHub allows 60 requests/hour per IP. Add a token in *Settings → General → GitHub*; the remaining
quota is shown there.

### Private repository: 404 / not found

The token needs access to it (fine-grained: the repository selected, *Contents: Read-only*). For a repository of
another account, give that repository its own token.

### Installed version shows an error

Use **Test URL** in the repository settings: it shows the response. Typical causes: wrong JSON field, the endpoint
needs an `Authorization` header, a self-signed certificate, or the URL isn't reachable **from the ReleaseWatcher
server** (e.g. a `localhost` URL inside a Docker container).

### I got no notification for a new release

- The first check only stores a baseline.
- The installed version is already ≥ the release.
- It's a pre-release and *Pre-releases* is off.
- *New releases* is switched off in *Settings → Notifications → What to send*.
- Digest mode: the summary is sent when the whole run ends.
- Use **Test** to check the channel itself.

## Notifications

### E-mail fails

- Port/security mismatch: `587` + `starttls`, `465` + `tls`.
- Gmail / Outlook need an **app password**, not your normal password.
- Certificates are always verified – a self-signed SMTP certificate fails.

### Discord shows no repository icon

Discord can't display SVG. Use a PNG URL or `sh:<name>.png`.

## Machines

### `Host key verification failed`

The machine's SSH host key changed (reinstall). *Settings → Connections → host → Forget host key*, then test again.

### `Permission denied (publickey)`

The public key isn't in `~/.ssh/authorized_keys` of that user, the key has a passphrase (not supported), or
`from="…"` doesn't match ReleaseWatcher's IP (in Docker: the host's IP as seen by the target).

### Non-root user: `sudo: a password is required`

The user needs passwordless `sudo` – see [[Connections and SSH]].

### VM: guest agent not running

Install and start `qemu-guest-agent` in the VM, enable *QEMU Guest Agent* in the VM's Proxmox options and restart the
VM (a reboot from inside is not enough after changing the option – stop and start it).

### Update stopped because it waits for input

The update showed an interactive prompt and printed nothing for 45 seconds. Make the command non-interactive, or run
that update once by hand. See [[Applications and updates]].

### Update timed out

Raise *Timeout (s)* of the application (default 30 minutes), or give the container more CPU/RAM during updates.

### Backup failed – update not started

By design. Check the backup storage of the node (*Settings → Connections → node → Edit*) and the run log; free space
on the storage or switch *Backup first* off.

### A container shows old results

It's stopped and *Start temporarily when stopped* is off – checks only read its status.

## Docker

### Endpoint test fails

- Socket mount: the container needs the socket's group (`group_add`), see [[Docker containers]].
- Socket proxy: `CONTAINERS=1` and `IMAGES=1` must be set; use the service name (`tcp://socket-proxy:2375`) on the
  same compose network.

### Version "unknown" / no "New image" state

Private images, digest-pinned or locally built images have no registry state. For `latest` the version is found only
if the registry has a version tag with the same digest among the newest 40 tags.

## Still stuck?

Open an [issue](https://github.com/Rozumek29/ReleaseWatcher/issues) with the version (`/api/version`), the install
method and the relevant log lines (remove secrets). See also [[FAQ]].
