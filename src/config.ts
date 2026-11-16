/** Application configuration read from environment variables (see .env.example). */
export interface Config {
  port: number;
  host: string;
  databasePath: string;
  pollIntervalMs: number;
  initialDelayMs: number;
  github: {
    apiBaseUrl: string;
    token: string | null;
    releasesPerPage: number;
  };
  discord: {
    webhookUrl: string | null;
    username: string | null;
    avatarUrl: string | null;
    mention: string | null;
    maxBodyLength: number;
  };
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): Config {
  return {
    port: int(env, 'PORT', 8080),
    host: str(env, 'HOST') ?? '0.0.0.0',
    databasePath: str(env, 'DATABASE_PATH') ?? 'releasewatcher.db',
    pollIntervalMs: int(env, 'POLL_INTERVAL_MINUTES', 15) * 60_000,
    initialDelayMs: int(env, 'POLL_INITIAL_DELAY_SECONDS', 10) * 1000,
    github: {
      apiBaseUrl: str(env, 'GITHUB_API_URL') ?? 'https://api.github.com',
      token: str(env, 'GITHUB_TOKEN'),
      releasesPerPage: int(env, 'GITHUB_RELEASES_PER_PAGE', 10),
    },
    discord: {
      webhookUrl: str(env, 'DISCORD_WEBHOOK_URL'),
      username: str(env, 'DISCORD_USERNAME') ?? 'ReleaseWatcher',
      avatarUrl: str(env, 'DISCORD_AVATAR_URL'),
      mention: str(env, 'DISCORD_MENTION'),
      maxBodyLength: int(env, 'DISCORD_MAX_BODY_LENGTH', 1500),
    },
  };
}

function str(env: Env, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

function int(env: Env, key: string, fallback: number): number {
  const raw = str(env, key);
  if (raw === null) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Environment variable ${key} must be a non-negative number, got "${raw}".`);
  }
  return value;
}
