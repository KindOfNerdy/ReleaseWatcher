/**
 * A few calls of Home Assistant's WebSocket API – for what its REST API does not offer, such as refreshing a
 * marketplace repository. One connection per call sequence: authenticate, send the commands in order, close.
 */
import { HomeAssistantApiError } from '../proxmox/home-assistant-api.ts';
import { isWebsite } from './domain.ts';

/** The part of a WebSocket the client uses (tests pass a fake). */
export interface SocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  send(data: string): void;
  close(): void;
}

export type SocketFactory = (url: string) => SocketLike;

/** A command and the field of its result the next one may use. */
export interface SocketCommand {
  type: string;
  [key: string]: unknown;
}

/** `ws(s)://…/api/websocket` for a Home Assistant base URL. */
export const websocketUrl = (baseUrl: string): string => `${baseUrl.replace(/^http/, 'ws')}/api/websocket`;

/**
 * Authenticates and runs the commands one after another; `next` builds each command from the previous result and may
 * return null to stop. Resolves with the last result. A refused command (`unauthorized`) becomes an unauthorized
 * `HomeAssistantApiError`, so callers can say that an administrator's token is needed.
 */
export function runCommands(
  connection: { url: string; token: string },
  first: SocketCommand,
  next: (result: unknown, index: number) => SocketCommand | null,
  options: { timeoutMs: number; socket?: SocketFactory },
): Promise<unknown> {
  const open = options.socket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  return new Promise((resolve, reject) => {
    let ws: SocketLike;
    let id = 0;
    let settled = false;
    const finish = (error: Error | null, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new HomeAssistantApiError('Home Assistant did not answer in time.')), options.timeoutMs);
    const send = (command: SocketCommand) => ws.send(JSON.stringify({ id: ++id, ...command }));
    try {
      ws = open(websocketUrl(connection.url));
    } catch (error) {
      clearTimeout(timer);
      reject(new HomeAssistantApiError(`Could not reach Home Assistant at ${connection.url}: ${String(error)}`));
      return;
    }
    ws.onerror = () => finish(new HomeAssistantApiError(`Could not reach Home Assistant at ${connection.url}.`));
    ws.onclose = () => finish(new HomeAssistantApiError('Home Assistant closed the connection.'));
    ws.onmessage = (event) => {
      let message: { type?: string; id?: number; success?: boolean; result?: unknown; error?: { code?: string; message?: string } };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: connection.token }));
      } else if (message.type === 'auth_invalid') {
        const error = new HomeAssistantApiError('Home Assistant rejected the access token – create a new long-lived access token in your profile.');
        error.unauthorized = true;
        finish(error);
      } else if (message.type === 'auth_ok') {
        send(first);
      } else if (message.type === 'result' && message.id === id) {
        if (!message.success) {
          const error = new HomeAssistantApiError(`Home Assistant refused ${message.error?.message ? `the request: ${message.error.message}` : 'the request'}.`);
          error.unauthorized = message.error?.code === 'unauthorized';
          finish(error);
          return;
        }
        const command = next(message.result, id);
        if (command) send(command);
        else finish(null, message.result);
      }
    };
  });
}

/**
 * Where the add-ons say their project is (entity id of their update entity → URLs to try in order), as the Supervisor
 * knows them – add-on update entities name no release. First the add-on's own URL; when that is only a website, also
 * the repository of its add-on store, unless the store too points elsewhere (another project's repository). An add-on
 * without any URL maps to an empty list. Empty without a Supervisor (Container and Core installations) or when the token
 * may not ask (the Supervisor API is for administrators only); this never fails a check.
 */
export async function addonProjectUrls(
  connection: { url: string; token: string },
  options: { timeoutMs: number; socket?: SocketFactory },
): Promise<Map<string, string[]>> {
  let registry: { entity_id?: unknown; platform?: unknown; unique_id?: unknown }[] = [];
  let addons: { slug?: unknown; url?: unknown; repository?: unknown }[] = [];
  try {
    const result = await runCommands(
      connection,
      { type: 'config/entity_registry/list' },
      (value, index) => {
        if (index === 1) {
          registry = Array.isArray(value) ? value : [];
          return { type: 'supervisor/api', endpoint: '/addons', method: 'get' };
        }
        if (index === 2) {
          addons = ((value ?? {}) as { addons?: typeof addons }).addons ?? [];
          return { type: 'supervisor/api', endpoint: '/store/repositories', method: 'get' };
        }
        return null;
      },
      options,
    );
    // The unique id of an add-on's update entity is `<slug>_version_latest`.
    const bySlug = new Map<string, string>();
    for (const entry of registry) {
      const id = typeof entry.unique_id === 'string' ? entry.unique_id : '';
      if (entry.platform === 'hassio' && typeof entry.entity_id === 'string' && id.endsWith('_version_latest')) {
        bySlug.set(id.slice(0, -'_version_latest'.length), entry.entity_id);
      }
    }
    const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
    const stores = new Map<string, { source: string | null; url: string | null }>();
    for (const store of Array.isArray(result) ? (result as { slug?: unknown; source?: unknown; url?: unknown }[]) : []) {
      const slug = text(store.slug);
      if (slug) stores.set(slug, { source: text(store.source), url: text(store.url) });
    }
    const urls = new Map<string, string[]>();
    for (const addon of addons) {
      const entityId = typeof addon.slug === 'string' ? bySlug.get(addon.slug) : undefined;
      if (!entityId) continue;
      const own = text(addon.url);
      const store = stores.get(text(addon.repository) ?? '');
      const candidates = own ? [own] : [];
      if (own && isWebsite(own) && store?.source && (!store.url || isWebsite(store.url))) {
        candidates.push(store.source);
      }
      urls.set(entityId, candidates);
    }
    return urls;
  } catch {
    return new Map();
  }
}

/**
 * Integrations whose update entities stand for a repository and the command that fetches its information again (what
 * *Update information* does): the marketplace built into Home Assistant and the custom integration HACS before it. The
 * unique id of such an update entity is the id of its repository. Both allow this to administrators only.
 */
const REFRESH_COMMANDS: Readonly<Record<string, string>> = {
  marketplace: 'marketplace/repository/refresh',
  hacs: 'hacs/repository/refresh',
};

/**
 * Asks the marketplace (or HACS) to fetch a repository's information again, so its update entity sees a new release
 * right away. Returns false when the entity belongs to neither (nothing was sent then).
 */
export async function refreshRepositoryEntity(
  connection: { url: string; token: string },
  entityId: string,
  options: { timeoutMs: number; socket?: SocketFactory },
): Promise<boolean> {
  let isStore = false;
  await runCommands(
    connection,
    { type: 'config/entity_registry/get', entity_id: entityId },
    (result, index) => {
      if (index !== 1) return null;
      const entry = (result ?? {}) as { platform?: unknown; unique_id?: unknown };
      const command = typeof entry.platform === 'string' ? REFRESH_COMMANDS[entry.platform] : undefined;
      if (!command || typeof entry.unique_id !== 'string') return null;
      isStore = true;
      return { type: command, repository: entry.unique_id };
    },
    options,
  );
  return isStore;
}
