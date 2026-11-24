# Development

The authoritative contributor guides are in the repository:

- [`AGENTS.md`](https://github.com/Rozumek29/ReleaseWatcher/blob/main/AGENTS.md) – workflow (branches, draft PRs,
  squash merge), commands, TypeScript rules, secrets, checklists for common changes.
- [`DESIGN.md`](https://github.com/Rozumek29/ReleaseWatcher/blob/main/DESIGN.md) – architecture, API conventions, UI
  design system.

This page is a short orientation.

## Requirements

- [Bun](https://bun.sh) 1.4.4+
- Node.js 26 (the Angular CLI runs on Node; Bun is its package manager)

## Run it

```bash
git clone https://github.com/Rozumek29/ReleaseWatcher.git && cd ReleaseWatcher
cp .env.example .env        # optional – everything can also be set in the UI
bun install
bun run dev                 # API on :8080 (watch) + Angular dev server on http://localhost:4200
```

The Angular dev server proxies `/api` to :8080.

| Script | What it does |
| --- | --- |
| `bun start` | build the UI if missing or outdated, start the app |
| `bun run dev` | API in watch mode + Angular dev server |
| `bun run build` | production UI build into `public/` |
| `bun run serve` | start the app without touching the UI build |
| `bun run test` | server tests (`bun test`) + UI tests (Vitest) – use this, not plain `bun test` |
| `bun run typecheck` | type-check the server (TypeScript 7) |
| `bun run build:executable` | single-file executable (server + UI) into `dist/` |
| `bun run package` | release artifacts in `release/` |
| `bun run deploy` | build and install/update in a Proxmox LXC |

Before a pull request run the same checks as CI:

```bash
bun run typecheck && bun run test && bun run build
```

## Tech stack

- **Server:** Bun 1.4 (`Bun.serve`, `bun:sqlite`, TypeScript run natively, no build step). The only runtime dependency
  is `@simplewebauthn/server` (passkeys).
- **UI:** Angular 22 – standalone components, signals, zoneless, no component library.
- **Storage:** SQLite with append-only migrations (`PRAGMA user_version`).

## Layout

```text
src/
  main.ts            entry point: config, DB, HTTP server, schedulers, shutdown
  app.ts             HTTP routes + static UI
  domain.ts          types, repository parsing, new-release selection (pure)
  version.ts         version parsing/comparison, installed-version reading
  advisories.ts      vulnerability ranges and impact
  checker.ts         checks repositories, dispatches notifications
  github.ts · osv.ts GitHub (ETag aware) and OSV.dev clients
  db.ts              store + migrations
  settings.ts        UI-editable settings over env vars
  secret-box.ts      AES-256-GCM for secrets at rest
  auth/              account, passkeys, sessions, API tokens
  hosts/             SSH keys, hosts, shell pool
  proxmox/           machines: domain, store, service (checks, updates, runs), scheduler, routes
  notifiers/         Notifier interface, dispatcher, Discord, e-mail/SMTP
test/                bun:test tests (fakes in test/helpers.ts – never real network)
web/                 Angular UI (builds into public/)
deploy/              systemd unit + install/uninstall scripts (embedded for --install)
scripts/             build-executable, package, deploy-lxc
```

## Principles

- **One process, one SQLite file**, no external services besides GitHub, OSV.dev, Discord, SMTP, SSH and registries.
- All I/O is injected into `buildApp(deps)` so tests use fakes.
- Long operations are **runs** (`202` + polling); commands that can outlive a connection run as transient systemd
  units on the node.
- Every schedule is a cron expression.
- Secrets never leave the server in full and are encrypted at rest.

## Adding a notifier

1. Implement `Notifier` from `src/notifiers/notifier.ts`: `notify()` (releases), `notifyVulnerability()`,
   `notifyContainerUpdates()`, `notifyUpdateResult()` and `notifyDigest()`.
2. Register it in `src/notifiers/index.ts` with options read through a callback (so UI changes apply without restart).
3. For UI configuration add the fields to `Settings` (`src/settings.ts`), the settings DTO and `PUT /api/settings`
   schema (`src/app.ts`), `web/src/app/core/models.ts` and the Settings page; document it in the README.

## Releases

Push a tag – the release workflow builds everything:

```bash
git tag v1.2.3 && git push origin v1.2.3      # stable
git tag beta-1.2.3 && git push origin beta-1.2.3  # pre-release
```

Push only the tag – a release created by hand on github.com has no files and makes the workflow fail.

## This wiki

The wiki is a separate git repository: `https://github.com/Rozumek29/ReleaseWatcher.wiki.git`. Page files use dashes
for spaces (`Connections-and-SSH.md` → `[[Connections and SSH]]`); `_Sidebar.md` and `_Footer.md` are shown on every
page. When code and wiki disagree, the code wins – please fix the page.
