import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyServerOptions } from 'fastify';
import { ReleaseChecker } from './checker.ts';
import type { RepositoryStore } from './db.ts';
import { fullName, ownerAvatarUrl, parseRepositoryName, type WatchedRepository } from './domain.ts';
import type { ReleaseSource } from './github.ts';
import { NotificationDispatcher } from './notifiers/dispatcher.ts';
import type { Notifier } from './notifiers/notifier.ts';
import { Poller } from './poller.ts';
import {
  MAX_POLL_INTERVAL_MINUTES,
  MIN_POLL_INTERVAL_MINUTES,
  maskSecret,
  SettingsValidationError,
  type SettingsPatch,
  type SettingsService,
} from './settings.ts';
import {
  compareVersions,
  fetchInstalledVersion,
  type HttpHeader,
  InstalledVersionError,
  MAX_CUSTOM_HEADERS,
  validateHeaders,
  validateVersionUrl,
} from './version.ts';

/** Header as sent by the UI. A missing/null value means "keep the value already saved for this name". */
interface HeaderInput {
  name: string;
  value?: string | null;
}

const headersSchema = {
  type: ['array', 'null'],
  maxItems: MAX_CUSTOM_HEADERS,
  items: {
    type: 'object',
    additionalProperties: false,
    properties: { name: { type: 'string', maxLength: 100 }, value: { type: ['string', 'null'], maxLength: 4000 } },
    required: ['name'],
  },
} as const;

/** Merges submitted headers with saved ones so secrets don't have to be sent back to the UI. */
function resolveHeaders(input: readonly HeaderInput[], saved: readonly HttpHeader[]): HttpHeader[] | { error: string } {
  const result: HttpHeader[] = [];
  for (const header of input) {
    const name = header.name.trim();
    if (!name) {
      continue;
    }
    const value = header.value ?? saved.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
    if (value === undefined) {
      return { error: `Enter a value for header "${name}".` };
    }
    result.push({ name, value: value.trim() });
  }
  return result;
}

export interface AppDeps {
  store: RepositoryStore;
  source: ReleaseSource;
  notifiers: readonly Notifier[];
  settings: SettingsService;
  /** Override for tests; defaults to a real HTTP fetch. */
  fetchInstalledVersion?: (
    url: string,
    field: string | null,
    headers: readonly HttpHeader[],
  ) => Promise<{ version: string; preview: string }>;
  /** Directory with the built Angular UI; skipped when missing. */
  publicDir?: string;
  logger?: FastifyServerOptions['logger'];
}

export interface App {
  server: FastifyInstance;
  checker: ReleaseChecker;
  /** Created but not started – call `poller.start()`. */
  poller: Poller;
}

/** Public shape of a watched repository (internal fields like the ETag are not exposed). */
export const toDto = (r: WatchedRepository) => ({
  id: r.id,
  owner: r.owner,
  name: r.name,
  fullName: fullName(r),
  url: `https://github.com/${fullName(r)}`,
  avatarUrl: ownerAvatarUrl(r.owner),
  includePrereleases: r.includePrereleases,
  isEnabled: r.isEnabled,
  lastSeenTag: r.lastSeenTag,
  lastSeenPublishedAt: r.lastSeenPublishedAt,
  lastCheckedAt: r.lastCheckedAt,
  lastError: r.lastError,
  createdAt: r.createdAt,
  installedVersionUrl: r.installedVersionUrl,
  installedVersionField: r.installedVersionField,
  // Only names are exposed; values may contain credentials.
  installedVersionHeaders: r.installedVersionHeaders.map((h) => ({ name: h.name, hasValue: h.value.length > 0 })),
  installedVersion: r.installedVersion,
  installedVersionCheckedAt: r.installedVersionCheckedAt,
  installedVersionError: r.installedVersionError,
  /** True/false when both versions are known and comparable, otherwise null. */
  updateAvailable: (() => {
    const diff = compareVersions(r.lastSeenTag, r.installedVersion);
    return diff === null ? null : diff > 0;
  })(),
});

const idParams = {
  type: 'object',
  properties: { id: { type: 'integer', minimum: 1 } },
  required: ['id'],
} as const;

/** RFC 7807-style error response, consumed by the UI. */
function problem(reply: FastifyReply, status: number, title: string, extra: Record<string, unknown> = {}) {
  return reply.code(status).type('application/problem+json').send({ status, title, ...extra });
}

export async function buildApp(deps: AppDeps): Promise<App> {
  const server = Fastify({ logger: deps.logger ?? true });
  const dispatcher = new NotificationDispatcher(deps.notifiers, server.log);
  const checker = new ReleaseChecker({
    store: deps.store,
    source: deps.source,
    dispatcher,
    log: server.log,
    ...(deps.fetchInstalledVersion ? { fetchInstalledVersion: deps.fetchInstalledVersion } : {}),
  });
  const { store, source, settings } = deps;
  const poller = new Poller(checker, () => settings.current.pollIntervalMinutes * 60_000, server.log);
  settings.onChange(() => poller.reschedule());
  server.addHook('onClose', () => poller.stop());

  const settingsDto = () => {
    const current = settings.current;
    return {
      discord: {
        webhookConfigured: !!current.discordWebhookUrl,
        webhookUrlMasked: maskSecret(current.discordWebhookUrl, 36),
        webhookSource: settings.sourceOf('discordWebhookUrl'),
        mention: current.discordMention,
        username: current.discordUsername,
      },
      github: {
        tokenConfigured: !!current.githubToken,
        tokenMasked: maskSecret(current.githubToken, 4),
        tokenSource: settings.sourceOf('githubToken'),
      },
      polling: {
        intervalMinutes: current.pollIntervalMinutes,
        intervalSource: settings.sourceOf('pollIntervalMinutes'),
        minIntervalMinutes: MIN_POLL_INTERVAL_MINUTES,
        maxIntervalMinutes: MAX_POLL_INTERVAL_MINUTES,
      },
    };
  };

  // Schema validation errors → same shape as the other validation problems.
  server.setErrorHandler((error: { validation?: unknown; statusCode?: number; message: string }, request, reply) => {
    if (error.validation) {
      return problem(reply, 400, 'One or more validation errors occurred.', { errors: { request: [error.message] } });
    }
    request.log.error(error);
    return problem(reply, error.statusCode ?? 500, 'An unexpected error occurred.');
  });

  server.get('/health', async () => ({ status: 'ok' }));

  server.get('/api/repositories', async () => store.list().map(toDto));

  server.get<{ Params: { id: number } }>('/api/repositories/:id', { schema: { params: idParams } }, async (req, reply) => {
    const repo = store.get(req.params.id);
    return repo ? toDto(repo) : problem(reply, 404, 'Repository not found.');
  });

  server.post<{ Body: { repository: string; includePrereleases?: boolean } }>(
    '/api/repositories',
    {
      schema: {
        body: {
          type: 'object',
          properties: { repository: { type: 'string' }, includePrereleases: { type: 'boolean' } },
          required: ['repository'],
        },
      },
    },
    async (req, reply) => {
      const parsed = parseRepositoryName(req.body.repository);
      if (!parsed) {
        return problem(reply, 400, 'One or more validation errors occurred.', {
          errors: { repository: ["Use the 'owner/repo' format or a https://github.com/owner/repo URL."] },
        });
      }

      const { owner, name } = parsed;
      if (store.exists(owner, name)) {
        return problem(reply, 409, `${owner}/${name} is already being watched.`);
      }

      try {
        if (!(await source.repositoryExists(owner, name))) {
          return problem(reply, 400, 'One or more validation errors occurred.', {
            errors: { repository: [`Repository ${owner}/${name} was not found on GitHub.`] },
          });
        }
      } catch (error) {
        return problem(reply, 502, 'Bad Gateway', { detail: error instanceof Error ? error.message : String(error) });
      }

      const repo = store.add(owner, name, req.body.includePrereleases ?? false);
      // Establish the baseline right away so the UI shows the current latest release.
      await checker.check(repo);

      return reply.code(201).header('location', `/api/repositories/${repo.id}`).send(toDto(repo));
    },
  );

  server.put<{
    Params: { id: number };
    Body: {
      includePrereleases: boolean;
      isEnabled: boolean;
      installedVersionUrl?: string | null;
      installedVersionField?: string | null;
      installedVersionHeaders?: HeaderInput[] | null;
    };
  }>(
    '/api/repositories/:id',
    {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          properties: {
            includePrereleases: { type: 'boolean' },
            isEnabled: { type: 'boolean' },
            installedVersionUrl: { type: ['string', 'null'], maxLength: 2000 },
            installedVersionField: { type: ['string', 'null'], maxLength: 200 },
            installedVersionHeaders: headersSchema,
          },
          required: ['includePrereleases', 'isEnabled'],
        },
      },
    },
    async (req, reply) => {
      const repo = store.get(req.params.id);
      if (!repo) {
        return problem(reply, 404, 'Repository not found.');
      }
      if (repo.includePrereleases !== req.body.includePrereleases) {
        // Filter changed: force a full fetch on the next check.
        repo.etag = null;
      }
      repo.includePrereleases = req.body.includePrereleases;
      repo.isEnabled = req.body.isEnabled;

      // Installed-version settings are optional in the body: undefined = keep, null/"" = clear.
      const { installedVersionUrl, installedVersionField, installedVersionHeaders } = req.body;
      if (installedVersionUrl !== undefined || installedVersionField !== undefined || installedVersionHeaders !== undefined) {
        const url = installedVersionUrl === undefined ? repo.installedVersionUrl : installedVersionUrl?.trim() || null;
        const field = installedVersionField === undefined ? repo.installedVersionField : installedVersionField?.trim() || null;
        const urlError = url ? validateVersionUrl(url) : null;
        if (urlError) {
          return problem(reply, 400, 'One or more validation errors occurred.', { errors: { installedVersionUrl: [urlError] } });
        }
        let headers = repo.installedVersionHeaders;
        if (installedVersionHeaders !== undefined) {
          const resolved = resolveHeaders(installedVersionHeaders ?? [], repo.installedVersionHeaders);
          const headerError = 'error' in resolved ? resolved.error : validateHeaders(resolved);
          if (headerError) {
            return problem(reply, 400, 'One or more validation errors occurred.', { errors: { installedVersionHeaders: [headerError] } });
          }
          headers = resolved as HttpHeader[];
        }
        const changed =
          url !== repo.installedVersionUrl ||
          field !== repo.installedVersionField ||
          JSON.stringify(headers) !== JSON.stringify(repo.installedVersionHeaders);
        repo.installedVersionUrl = url;
        repo.installedVersionField = field;
        repo.installedVersionHeaders = headers;
        if (changed) {
          await checker.refreshInstalledVersion(repo);
        }
      }

      store.save(repo);
      return toDto(repo);
    },
  );

  // Tries an installed-version URL without saving it (used by the "Test" button in the UI).
  // `repositoryId` lets headers without a value reuse the secret saved for that repository.
  server.post<{ Body: { url: string; field?: string | null; headers?: HeaderInput[] | null; repositoryId?: number | null } }>(
    '/api/installed-version/test',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            url: { type: 'string', maxLength: 2000 },
            field: { type: ['string', 'null'], maxLength: 200 },
            headers: headersSchema,
            repositoryId: { type: ['integer', 'null'] },
          },
          required: ['url'],
        },
      },
    },
    async (req, reply) => {
      const urlError = validateVersionUrl(req.body.url.trim());
      if (urlError) {
        return problem(reply, 400, 'One or more validation errors occurred.', { errors: { installedVersionUrl: [urlError] } });
      }
      const saved = req.body.repositoryId ? (store.get(req.body.repositoryId)?.installedVersionHeaders ?? []) : [];
      const resolved = resolveHeaders(req.body.headers ?? [], saved);
      const headerError = 'error' in resolved ? resolved.error : validateHeaders(resolved);
      if (headerError) {
        return problem(reply, 400, 'One or more validation errors occurred.', { errors: { installedVersionHeaders: [headerError] } });
      }
      try {
        return await (deps.fetchInstalledVersion ?? fetchInstalledVersion)(
          req.body.url.trim(),
          req.body.field?.trim() || null,
          resolved as HttpHeader[],
        );
      } catch (error) {
        if (error instanceof InstalledVersionError) {
          return problem(reply, 422, error.message);
        }
        throw error;
      }
    },
  );

  server.delete<{ Params: { id: number } }>('/api/repositories/:id', { schema: { params: idParams } }, async (req, reply) =>
    store.delete(req.params.id) ? reply.code(204).send() : problem(reply, 404, 'Repository not found.'),
  );

  server.post<{ Params: { id: number } }>('/api/repositories/:id/check', { schema: { params: idParams } }, async (req, reply) => {
    const repo = store.get(req.params.id);
    if (!repo) {
      return problem(reply, 404, 'Repository not found.');
    }
    const result = await checker.check(repo);
    return { repository: toDto(repo), notifiedCount: result.notifiedCount };
  });

  server.get('/api/notifiers', async () => deps.notifiers.map((n) => ({ name: n.name, isEnabled: n.isEnabled })));

  // Sends a fake release to every enabled notifier to verify the configuration.
  server.post('/api/notifiers/test', async () =>
    dispatcher.dispatch({
      owner: 'releasewatcher',
      repository: 'test',
      release: {
        tag: 'v0.0.0-test',
        name: 'Test notification',
        htmlUrl: 'https://github.com',
        body: 'If you can read this, ReleaseWatcher can reach this channel. 🎉',
        isPrerelease: false,
        publishedAt: new Date().toISOString(),
        authorLogin: null,
        authorAvatarUrl: null,
      },
    }),
  );

  server.get('/api/settings', async () => settingsDto());

  const nullableString = { type: ['string', 'null'] } as const;
  server.put<{ Body: SettingsPatch }>(
    '/api/settings',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            discordWebhookUrl: nullableString,
            discordMention: nullableString,
            discordUsername: nullableString,
            githubToken: nullableString,
            pollIntervalMinutes: { type: ['number', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        settings.update(req.body);
      } catch (error) {
        if (error instanceof SettingsValidationError) {
          return problem(reply, 400, 'One or more validation errors occurred.', { errors: { [error.field]: [error.message] } });
        }
        throw error;
      }
      return settingsDto();
    },
  );

  const statusDto = () => {
    const repositories = store.list();
    return {
      poller: poller.status,
      repositories: {
        total: repositories.length,
        enabled: repositories.filter((r) => r.isEnabled).length,
        withErrors: repositories.filter((r) => r.lastError).length,
        updatesAvailable: repositories.filter((r) => toDto(r).updateAvailable).length,
      },
    };
  };

  server.get('/api/status', async () => statusDto());

  // Checks all enabled repositories right away.
  server.post('/api/check-all', async () => {
    await poller.runNow();
    return statusDto();
  });

  server.get('/api/github/rate-limit', async (_req, reply) => {
    try {
      return (await source.getRateLimit?.()) ?? null;
    } catch (error) {
      return problem(reply, 502, 'Bad Gateway', { detail: error instanceof Error ? error.message : String(error) });
    }
  });

  // Angular UI + SPA fallback.
  const hasUi = deps.publicDir !== undefined && existsSync(deps.publicDir);
  if (hasUi) {
    await server.register(fastifyStatic, { root: deps.publicDir! });
  }
  server.setNotFoundHandler((req, reply) => {
    if (hasUi && req.method === 'GET' && !req.url.startsWith('/api/')) {
      return reply.sendFile('index.html');
    }
    return problem(reply, 404, 'Not found.');
  });

  return { server, checker, poller };
}
