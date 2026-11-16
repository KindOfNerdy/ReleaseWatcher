import type { ReleaseInfo } from '../src/domain.ts';
import type { ReleaseFetchResult, ReleaseSource } from '../src/github.ts';
import type { Notifier, ReleaseNotification } from '../src/notifiers/notifier.ts';

export const silentLog = { info() {}, warn() {}, error() {} };

export function release(tag: string, day: number, isPrerelease = false): ReleaseInfo {
  return {
    tag,
    name: null,
    htmlUrl: `https://github.com/acme/widget/releases/${tag}`,
    body: 'notes',
    isPrerelease,
    publishedAt: new Date(Date.UTC(2026, 0, 1 + day)).toISOString(),
    authorLogin: 'bob',
    authorAvatarUrl: null,
  };
}

export const dayIso = (day: number): string => new Date(Date.UTC(2026, 0, 1 + day)).toISOString();

export class FakeSource implements ReleaseSource {
  releases: ReleaseInfo[] = [];
  notModified = false;
  error: Error | null = null;
  existing = new Set(['acme/widget']);
  calls = 0;

  async repositoryExists(owner: string, name: string): Promise<boolean> {
    return this.existing.has(`${owner}/${name}`.toLowerCase());
  }

  async getRecentReleases(_owner: string, _name: string, etag: string | null): Promise<ReleaseFetchResult> {
    this.calls++;
    if (this.error) {
      throw this.error;
    }
    return this.notModified
      ? { releases: [], etag, notModified: true }
      : { releases: this.releases, etag: '"etag"', notModified: false };
  }
}

export class RecordingNotifier implements Notifier {
  readonly name = 'recording';
  isEnabled = true;
  fail = false;
  readonly sent: ReleaseNotification[] = [];

  async notify(notification: ReleaseNotification): Promise<void> {
    if (this.fail) {
      throw new Error('boom');
    }
    this.sent.push(notification);
  }
}
