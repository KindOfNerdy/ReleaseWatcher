# Docker containers

ReleaseWatcher lists running **Docker** and **Podman** containers on the **Docker** page (and in the detail of each
machine), shows their installed version and tells you when a newer image or release is available.
**It is read-only: nothing is pulled, restarted or changed.**

## Sources

### Machines reached over SSH – automatic

Every check of a server, Proxmox container, VM or node runs `docker ps` / `docker inspect` (or `podman`) when the CLI
is installed – nothing to configure ([[Machines]]).

- The SSH user needs access to the runtime: `root`, `sudo`, or the `docker` group.
- Rootless Podman containers of other users are not listed.
- Switch **Docker containers** off in a machine's settings to stop it (its containers are forgotten).

### Docker endpoints – without SSH

**Settings → Connections → Docker endpoints → Add**: a name and a URL. **Test** shows the engine and the number of
containers without saving.

| URL | Use |
| --- | --- |
| `tcp://socket-proxy:2375` | a socket proxy on the same compose network (recommended) |
| `unix:///var/run/docker.sock` | the Docker socket mounted into ReleaseWatcher's container |
| `unix:///run/podman/podman.sock` | the Podman socket |
| `tcp://nas.lan:2375`, `https://…` | a remote engine (e.g. a NAS) |

Endpoints are listed on `DOCKER_CHECK_CRON` (default `0 */6 * * *`) and with **Check** on the page.

## What you see per container

### Installed version

1. A version tag (`nginx:1.27.3`) is used as it is; a label that refines it wins (tag `16`, label `16.4` → `16.4`).
2. For `latest` and other floating tags, the **registry tag with the same digest** as the running image is looked up
   (the newest 40 tags of the same flavour – `-alpine` stays `-alpine` – compared once per digest).
3. Fallback: the `org.opencontainers.image.version` label (or linuxserver.io's `build_version`).
4. Otherwise: *unknown* (filter **Version unknown**).

### New image

The registry's current digest of the running tag is compared with the image's digest (`RepoDigests`). *New image*
appears even for projects that never publish releases (e.g. SearXNG).

- Checked on `DOCKER_CHECK_CRON` and with every machine check.
- One `HEAD` request per tag – it **does not count** against Docker Hub's pull limit.
- Registries: Docker Hub, GHCR, lscr.io, Quay and any OCI registry with anonymous tokens – **public images only**.
- Images pinned to a digest or built locally show no image state.

### Repository link

Linked automatically when labels name a repository on GitHub, Gitea/Forgejo or GitLab:

1. your own label `releasewatcher.repo=owner/name` (or the URL of a repository on another host),
2. otherwise `org.opencontainers.image.source` (e.g. `https://codeberg.org/forgejo/forgejo`),
3. otherwise `org.opencontainers.image.url` – only when it points to GitHub.

The repository is watched; one that isn't watched yet is offered with **Watch owner/name** (`host/owner/name` outside
GitHub). A link can also be chosen
by hand. A linked container shows *Update available* for newer releases, and its installed version counts for the
repository's [[Vulnerabilities]].

### Grouping and ignoring

- Containers are grouped by compose project (`com.docker.compose.project`).
- **Ignore** a container in the UI or with the label `releasewatcher.ignore=true`.
- Ignored and hand-linked containers keep their setting when they are re-created.

Example labels:

```yaml
services:
  myapp:
    image: ghcr.io/me/myapp:latest
    labels:
      releasewatcher.repo: me/myapp
  sidecar:
    image: busybox
    labels:
      releasewatcher.ignore: "true"
```

## Setups

### Socket proxy (recommended)

The proxy allows only the listed read-only API sections; ReleaseWatcher never sees the socket.

```yaml
services:
  releasewatcher:
    image: ghcr.io/rozumek29/releasewatcher:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - releasewatcher-data:/data
    # Then add the endpoint tcp://socket-proxy:2375 under Settings → Connections → Docker endpoints.

  socket-proxy:
    image: lscr.io/linuxserver/socket-proxy:latest
    restart: unless-stopped
    environment:
      - CONTAINERS=1   # GET /containers/json
      - IMAGES=1       # GET /images/{id}/json (digests for "New image" and the version lookup)
      - VERSION=1      # GET /version (on by default)
      - POST=0         # read-only
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    read_only: true
    tmpfs:
      - /run

volumes:
  releasewatcher-data:
```

`tecnativa/docker-socket-proxy` works the same way (`CONTAINERS=1`, `IMAGES=1`). Don't publish the proxy's port to the
network. Requests used: `GET /version`, `/containers/json`, `/images/{id}/json`.

### Mounting the socket

```yaml
services:
  releasewatcher:
    image: ghcr.io/rozumek29/releasewatcher:latest
    volumes:
      - releasewatcher-data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    group_add:
      - "999"   # GID of the socket on the host: stat -c %g /var/run/docker.sock
```

The image runs as an unprivileged user, so it needs the socket's group. `:ro` does **not** make the Docker API
read-only – anyone with the socket controls Docker; prefer the socket proxy.

### Remote engine over TCP

An engine listening on TCP (`dockerd -H tcp://0.0.0.0:2375`, or a socket proxy on another host) is added as
`tcp://host:2375`. Plain TCP is unencrypted and unauthenticated – use it only in a trusted network, or put a read-only
socket proxy in front. **TLS client certificates are not supported yet.**

### Synology NAS

Use `/var/run/docker.sock` (Container Manager) with a socket proxy as above, and add `tcp://socket-proxy:2375`.

## Docker page

- Filters **All, Updates, Version unknown**, search, grouped by source and compose project.
- **Check** asks the endpoints and registries again now.
- A newer image of a tag a container runs is reported once as *New Docker images* ([[Notifications]]); other Docker
  states are shown in the UI only.

## API

`/api/docker`, `/api/docker/endpoints…`, `/api/docker/containers/:id` – see [[REST API]].
