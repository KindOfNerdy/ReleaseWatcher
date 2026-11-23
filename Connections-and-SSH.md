# Connections and SSH

Everything ReleaseWatcher does on your machines goes through **SSH** – one connection per host. Guests (LXC
containers and VMs) need **no SSH server**: commands reach them through the Proxmox node (`pct exec`,
`qm guest exec`). Connections are managed in **Settings → Connections**, which has three lists: **SSH keys**,
**Hosts** and **Docker endpoints** ([[Docker containers]]).

## SSH keys

Named private keys, shared by any number of hosts – one key for every machine or one per machine.

- **Generate key** creates an **Ed25519** key pair on the server and shows the public key. Copy it into
  `~/.ssh/authorized_keys` of the user on the node or server.
- **Add key** pastes an existing private key (OpenSSH format; checked with `ssh-keygen`).
- Private keys are encrypted at rest and **never shown again** – only the public key and fingerprint.
- Keys protected with a **passphrase are not supported**.
- A key used by a host cannot be removed (rename it, or move the hosts to another key first).

Add the public key on the target:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA… releasewatcher' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

> [!TIP]
> Restrict the key to ReleaseWatcher's IP: `from="192.168.1.50" ssh-ed25519 AAAA…` in `authorized_keys`, and use a key
> dedicated to ReleaseWatcher.

## Hosts

**Add host** opens one dialog for both kinds:

| Type | What it is | Used for |
| --- | --- | --- |
| **Proxmox node** | a PVE host (add as many as you have) | its LXC containers, VMs and the node itself |
| **Server** | any Debian/Ubuntu machine reachable over SSH (VPS, Raspberry Pi, bare metal) | the server itself |

Fields: name, **address**, **port** (22), **SSH user**, **SSH key**. A Proxmox node also has a **Backup storage**
(*Edit* → *Backup storage*; none = no backups before updates of its guests – see [[Applications and updates]]).

**SSH user:**

- `root` – simplest;
- or another user with **passwordless `sudo`**: every command is then wrapped as `sudo -n -- sh -c '…'`.

Because the whole command runs through `sh` as root, a non-root user needs a rule like this
(`visudo -f /etc/sudoers.d/releasewatcher`):

```
releasewatcher ALL=(root) NOPASSWD: /bin/sh
```

> [!NOTE]
> That is effectively root access – a separate user mainly gives you a separate login and audit trail, not less
> privilege. `root` with a dedicated, IP-restricted key is the simplest equivalent setup.

Actions per host:

- **Test connection** – runs `pveversion` (Proxmox) or `uname -a` (server) and shows the result.
- **Forget host key** – see below.
- **Remove** – a server's machine goes with it; a Proxmox node can be removed only when it has no watched machines.

Changes (address, user, key) apply to the next command – no restart.

## Host keys (trust on first use)

The first connection trusts the host's SSH key and pins it in `known_hosts` next to the database (or
`SSH_KNOWN_HOSTS_FILE`). Later connections fail if the key changes – protection against a machine-in-the-middle.

After **reinstalling** a machine, click **Forget host key** on the host; the next connection pins the new key.

## How commands are run

| Target | Command |
| --- | --- |
| LXC container | on the node: `pct exec <vmid> -- sh -lc '…'` |
| Virtual machine | on the node: `qm guest exec <vmid> -- sh -c '…'` (QEMU guest agent) |
| Proxmox node | directly on the node |
| Server | directly: `sh -lc '…'` over SSH |

Only public-key authentication is used (`BatchMode`, no passwords, no agent). The system `ssh` client is used, which
is why the Docker image includes `openssh-client` and `--install` installs it.

## Upgrading from older versions

A Proxmox node configured by an older version (in Settings or with `PROXMOX_HOST`, `PROXMOX_SSH_*`,
`PROXMOX_SSH_KEY_FILE`) is moved into a host with a key named *Proxmox node* on the first start. After that, the
`PROXMOX_*` variables are ignored – edit the host in Settings.

## Next

→ [[Machines]]
