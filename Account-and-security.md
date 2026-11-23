# Account and security

The UI and the API require a login – **one account** that signs in with a **password** and/or **passkeys**. Manage it
on the **Account** page.

> [!CAUTION]
> **The UI can run commands as root on your Proxmox nodes and servers.** Keep it on a private network or behind HTTPS
> – over plain HTTP the password and the session cookie travel in clear text. The server also fetches the
> installed-version URLs you configure (usually LAN addresses).

## First start and setup code

On the first start the app logs a one-time **setup code** (also written to `setup-code` next to the database). Enter
it in the UI with a user name and a password (**10+ characters**). Nobody without the code can claim a fresh
installation. See [[First steps]].

## User name and password

*Account → User name & password*. The **current password** is required to save any change. Changing the password signs
out all other sessions. Passwords are stored as **argon2id** hashes.

## Passkeys

Sign in with Windows Hello, Touch ID, your phone or a security key – no password needed.

- *Account → Passkeys → Add passkey*, give it a name. Rename or remove passkeys there.
- Passkeys need **HTTPS with a host name** (or `localhost`). Behind a reverse proxy set
  `PUBLIC_URL=https://watcher.example.com` and `TRUST_PROXY=true` ([[Installation]] → Reverse proxy).
- `PUBLIC_URL` pins the relying party: passkeys are bound to that host name – changing it later makes existing
  passkeys unusable.

### Passkeys only

With at least one passkey, **Allow password sign-in** can be switched off (confirmed with the current password):

- the password then only confirms account changes,
- passkey sign-ins require user verification (PIN or biometrics),
- other sessions opened with the password are signed out,
- the sign-in screen opens the passkey prompt right away,
- the last passkey cannot be removed while it is off.

Lost every passkey? See [Reset the login](#reset-the-login).

## Sessions

- HttpOnly, `SameSite=Strict` cookie (`Secure` over HTTPS), valid **30 days**, extended while in use.
- *Account → Signed-in sessions* lists browsers (with *This browser*); sign out one or all others.
- Stored only as SHA-256 hashes of their tokens.
- Repeated failed logins lock the client out with growing delays (`429`). Behind a proxy, `TRUST_PROXY=true` makes the
  lockout use the real client IP.
- State-changing requests from other sites are refused (Origin check).

## API tokens

For dashboards and scripts – see [[API tokens]].

## Secrets at rest

Secrets in the database are encrypted with **AES-256-GCM**:

Discord webhook, SMTP password, GitHub tokens (global and per repository), SSH private keys, installed-version header
values, the Home Assistant access token.

- The key comes from `ENCRYPTION_KEY` (32 bytes, base64 or hex – `openssl rand -base64 32`) or from `encryption.key`,
  generated next to the database on the first start.
- **Back up the key.** Without it the app refuses to start on that database.
- The API never returns secrets – only masked hints (`ghp_…abcd`) or `hasX` flags.
- Passwords (argon2id), sessions and API tokens (SHA-256) are hashed, not encrypted.

## Hardening checklist

- [ ] HTTPS via a reverse proxy, `PUBLIC_URL` and `TRUST_PROXY` set.
- [ ] Not exposed to the internet (VPN / LAN only) – or at least passkeys only.
- [ ] Dedicated SSH key, restricted with `from="<ip>"` in `authorized_keys` ([[Connections and SSH]]).
- [ ] Docker via a read-only socket proxy, not the raw socket ([[Docker containers]]).
- [ ] Dashboards use **read-only** API tokens with an expiry.
- [ ] Backups of the data directory and of `encryption.key` / `ENCRYPTION_KEY` stored separately.

## Reset the login

Forgot the password, no passkey at hand, or lost every passkey with password sign-in off. This removes the account,
its passkeys, sessions and API tokens – **nothing else**:

**Native / LXC:**

```bash
# in the container (on the node: prefix each command with `pct exec <vmid> --`)
sed -i '/^BASIC_AUTH_/d' /etc/releasewatcher/releasewatcher.env   # else old credentials come back on restart
runuser -u releasewatcher -- env DATABASE_PATH=/var/lib/releasewatcher/releasewatcher.db \
  /opt/releasewatcher/releasewatcher --reset-login
systemctl restart releasewatcher
cat /var/lib/releasewatcher/setup-code
```

**Docker** (the executable in the image is the same; stop the app first so only one process uses the database):

```bash
docker stop releasewatcher
docker run --rm -v releasewatcher-data:/data ghcr.io/rozumek29/releasewatcher:latest --reset-login
docker start releasewatcher
docker exec releasewatcher cat /data/setup-code
```

Then create the account again with the new setup code.

## Upgrading from Basic auth

Installs made with an early `bun run deploy` have a generated password in `/etc/releasewatcher/releasewatcher.env`
(`grep BASIC_AUTH` it). When `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` are set and no account exists, the account
is created with them on the first start – sign in with the same credentials.
