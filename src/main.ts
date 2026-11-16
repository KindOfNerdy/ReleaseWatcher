import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.ts';
import { loadConfig } from './config.ts';
import { RepositoryStore } from './db.ts';
import { GitHubReleaseSource } from './github.ts';
import { createNotifiers } from './notifiers/index.ts';
import { SettingsService } from './settings.ts';

// Load .env from the project root (if present). Variables already set in the environment win.
// Done here rather than with --env-file-if-exists because `node --watch` crashes when that file is missing.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
const store = new RepositoryStore(config.databasePath);
const settings = new SettingsService(store, config);
const notifiers = createNotifiers(config, settings);

const { server, poller } = await buildApp({
  store,
  settings,
  source: new GitHubReleaseSource({ ...config.github, token: () => settings.current.githubToken }),
  notifiers,
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
});

const shutdown = async (signal: string) => {
  server.log.info({ signal }, 'Shutting down');
  await server.close(); // also stops the poller
  store.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await server.listen({ port: config.port, host: config.host });
poller.start(config.initialDelayMs);
server.log.info(
  {
    intervalMinutes: settings.current.pollIntervalMinutes,
    notifiers: notifiers.filter((n) => n.isEnabled).map((n) => n.name),
  },
  'ReleaseWatcher started',
);
