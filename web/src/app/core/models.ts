export interface WatchedRepository {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  /** Avatar of the owner (user or organization). */
  avatarUrl: string;
  includePrereleases: boolean;
  isEnabled: boolean;
  lastSeenTag: string | null;
  lastSeenPublishedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  installedVersionUrl: string | null;
  installedVersionField: string | null;
  /** Header names only – values are secrets and never leave the server. */
  installedVersionHeaders: { name: string; hasValue: boolean }[];
  installedVersion: string | null;
  installedVersionCheckedAt: string | null;
  installedVersionError: string | null;
  /** True when the latest release is newer than the installed version; null when unknown. */
  updateAvailable: boolean | null;
}

export interface AddRepositoryRequest {
  repository: string;
  includePrereleases: boolean;
}

export interface UpdateRepositoryRequest {
  includePrereleases: boolean;
  isEnabled: boolean;
  /** Omit to keep, null to clear. */
  installedVersionUrl?: string | null;
  installedVersionField?: string | null;
  installedVersionHeaders?: HeaderInput[] | null;
}

/** A header sent to the server. `value: null` keeps the value already saved under that name. */
export interface HeaderInput {
  name: string;
  value: string | null;
}

export interface InstalledVersionTestResult {
  version: string;
  preview: string;
}

export interface CheckResult {
  repository: WatchedRepository;
  notifiedCount: number;
}

export interface Notifier {
  name: string;
  isEnabled: boolean;
}

export interface TestNotificationResult {
  sent: string[];
  failed: string[];
}

/** Where an effective setting value comes from: saved in the UI, environment variable, or not set. */
export type SettingSource = 'ui' | 'env' | null;

export interface AppSettings {
  discord: {
    webhookConfigured: boolean;
    webhookUrlMasked: string | null;
    webhookSource: SettingSource;
    mention: string | null;
    username: string | null;
  };
  github: {
    tokenConfigured: boolean;
    tokenMasked: string | null;
    tokenSource: SettingSource;
  };
  polling: {
    intervalMinutes: number;
    intervalSource: SettingSource;
    minIntervalMinutes: number;
    maxIntervalMinutes: number;
  };
}

/** `undefined` keeps a value, `null` resets it to the environment default. */
export interface SettingsPatch {
  discordWebhookUrl?: string | null;
  discordMention?: string | null;
  discordUsername?: string | null;
  githubToken?: string | null;
  pollIntervalMinutes?: number | null;
}

export interface AppStatus {
  poller: {
    intervalMinutes: number;
    isRunning: boolean;
    lastRunStartedAt: string | null;
    lastRunFinishedAt: string | null;
    nextRunAt: string | null;
  };
  repositories: {
    total: number;
    enabled: number;
    withErrors: number;
    updatesAvailable: number;
  };
}

export interface RateLimit {
  limit: number;
  remaining: number;
  resetAt: string;
}
