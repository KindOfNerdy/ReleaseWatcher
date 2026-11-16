import type { Config } from './config.ts';
import type { RepositoryStore } from './db.ts';

/** Runtime settings editable from the UI. Values stored in the database override environment defaults. */
export interface Settings {
  discordWebhookUrl: string | null;
  discordMention: string | null;
  discordUsername: string | null;
  githubToken: string | null;
  pollIntervalMinutes: number;
}

export type SettingKey = keyof Settings;
export type SettingsPatch = { [K in SettingKey]?: Settings[K] | null };

export const MIN_POLL_INTERVAL_MINUTES = 1;
export const MAX_POLL_INTERVAL_MINUTES = 24 * 60;

export class SettingsValidationError extends Error {
  readonly field: SettingKey;

  constructor(field: SettingKey, message: string) {
    super(message);
    this.name = 'SettingsValidationError';
    this.field = field;
  }
}

/** Where the effective value of a setting comes from. */
export type SettingSource = 'ui' | 'env' | null;

export class SettingsService {
  private readonly store: RepositoryStore;
  private readonly defaults: Settings;
  private overrides: Partial<Record<SettingKey, string>>;
  private readonly listeners = new Set<(settings: Settings) => void>();

  constructor(store: RepositoryStore, config: Config) {
    this.store = store;
    this.defaults = {
      discordWebhookUrl: config.discord.webhookUrl,
      discordMention: config.discord.mention,
      discordUsername: config.discord.username,
      githubToken: config.github.token,
      pollIntervalMinutes: config.pollIntervalMs / 60_000,
    };
    this.overrides = store.readSettings() as Partial<Record<SettingKey, string>>;
  }

  get current(): Settings {
    const o = this.overrides;
    return {
      discordWebhookUrl: o.discordWebhookUrl ?? this.defaults.discordWebhookUrl,
      discordMention: o.discordMention ?? this.defaults.discordMention,
      discordUsername: o.discordUsername ?? this.defaults.discordUsername,
      githubToken: o.githubToken ?? this.defaults.githubToken,
      pollIntervalMinutes: o.pollIntervalMinutes !== undefined ? Number(o.pollIntervalMinutes) : this.defaults.pollIntervalMinutes,
    };
  }

  sourceOf(key: SettingKey): SettingSource {
    if (this.overrides[key] !== undefined) {
      return 'ui';
    }
    const value = this.defaults[key];
    return value === null || value === '' ? null : 'env';
  }

  /**
   * Applies a partial update. `undefined` keeps a value, `null` or an empty string removes the override
   * (the environment default applies again).
   */
  update(patch: SettingsPatch): Settings {
    const normalized = new Map<SettingKey, string | null>();

    for (const [key, raw] of Object.entries(patch) as [SettingKey, unknown][]) {
      if (raw === undefined) {
        continue;
      }
      const text = raw === null ? '' : String(raw).trim();
      if (text === '') {
        normalized.set(key, null);
        continue;
      }
      validate(key, text);
      normalized.set(key, text);
    }

    for (const [key, value] of normalized) {
      this.store.writeSetting(key, value);
    }
    this.overrides = this.store.readSettings() as Partial<Record<SettingKey, string>>;

    const settings = this.current;
    for (const listener of this.listeners) {
      listener(settings);
    }
    return settings;
  }

  onChange(listener: (settings: Settings) => void): void {
    this.listeners.add(listener);
  }
}

function validate(key: SettingKey, value: string): void {
  switch (key) {
    case 'discordWebhookUrl': {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new SettingsValidationError(key, 'Webhook URL must be a valid URL.');
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new SettingsValidationError(key, 'Webhook URL must use http(s).');
      }
      return;
    }
    case 'pollIntervalMinutes': {
      const minutes = Number(value);
      if (!Number.isFinite(minutes) || minutes < MIN_POLL_INTERVAL_MINUTES || minutes > MAX_POLL_INTERVAL_MINUTES) {
        throw new SettingsValidationError(
          key,
          `Interval must be between ${MIN_POLL_INTERVAL_MINUTES} and ${MAX_POLL_INTERVAL_MINUTES} minutes.`,
        );
      }
      return;
    }
    case 'discordMention':
      if (value.length > 200) {
        throw new SettingsValidationError(key, 'Mention is too long.');
      }
      return;
    case 'discordUsername':
      if (value.length > 80) {
        throw new SettingsValidationError(key, 'Username must be at most 80 characters.');
      }
      return;
    case 'githubToken':
      return;
  }
}

/** Shows only the beginning and end of a secret, e.g. "https://discord.com/api/webhooks/12…abcd". */
export function maskSecret(value: string | null, visibleStart: number, visibleEnd = 4): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= visibleStart + visibleEnd) {
    return '•'.repeat(value.length);
  }
  return `${value.slice(0, visibleStart)}…${value.slice(-visibleEnd)}`;
}
