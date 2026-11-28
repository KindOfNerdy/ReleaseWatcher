import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ClockService } from '../../core/clock.service';
import { HomeAssistantComponent, HomeAssistantConnection, HomeAssistantOverview } from '../../core/models';
import { StatusService } from '../../core/status.service';
import { ToastService } from '../../core/toast.service';
import { describeCron } from '../../shared/cron';
import { Icon } from '../../shared/icon';
import { RelativeTimePipe } from '../../shared/relative-time.pipe';

export type HomeAssistantFilter = 'all' | 'updates' | 'unwatched';

/** A newer release of the watched repository, or a newer version known to Home Assistant. */
export const hasUpdate = (c: HomeAssistantComponent): boolean => c.updateAvailable === true || c.homeAssistantUpdate;

/** The version an update would bring: the repository's latest release when it is newer, else what Home Assistant knows. */
export const newerVersion = (c: HomeAssistantComponent): string | null =>
  c.updateAvailable === true ? (c.repository?.latestVersion ?? null) : c.homeAssistantUpdate ? c.latestVersion : null;

/** One card: a connection with the components read from it. */
interface ConnectionCard {
  connection: HomeAssistantConnection;
  components: HomeAssistantComponent[];
}

/** The operating system restarts the whole machine: "Update" leaves it out, it is installed on its own. */
export const OS_ENTITY_ID = 'update.home_assistant_operating_system_update';

/** While a connection or the scheduled run is being read, the page reloads this often. */
const POLL_MS = 2000;

/** Link to a repository named by a component (`owner/name` on GitHub, `host/owner/name` elsewhere). */
export const repositoryLink = (repository: string): string =>
  repository.split('/').length > 2 ? `https://${repository}` : `https://github.com/${repository}`;

/**
 * Home Assistant page: what is installed in the Home Assistant instances connected under Settings → Connections –
 * Core, add-ons, integrations and cards whose update entity names a repository.
 */
@Component({
  selector: 'app-home-assistant-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RelativeTimePipe, RouterLink],
  templateUrl: './home-assistant.page.html',
  styleUrl: './home-assistant.page.scss',
})
export class HomeAssistantPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly statusService = inject(StatusService);
  protected readonly describeCron = describeCron;
  protected readonly repositoryLink = repositoryLink;

  protected readonly overview = signal<HomeAssistantOverview | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly filter = signal<HomeAssistantFilter>('all');
  protected readonly checkingAll = signal(false);
  protected readonly now = inject(ClockService).now;

  protected readonly filters: { value: HomeAssistantFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'updates', label: 'Updates' },
    { value: 'unwatched', label: 'Not watched' },
  ];
  /** Search over component and repository names. */
  protected readonly query = signal('');
  /** Component whose installation is being confirmed, and whether a backup is asked for. */
  protected readonly confirming = signal<number | null>(null);
  protected readonly backupFirst = signal(true);
  /** Component ids Home Assistant is checking right now. */
  protected readonly refreshing = signal<ReadonlySet<number>>(new Set());
  /** Connection whose restart is being confirmed. */
  protected readonly confirmingRestart = signal<number | null>(null);
  /** Component ids whose repository is being added to the watch list. */
  protected readonly watching = signal<ReadonlySet<number>>(new Set());
  /** Components ticked for "Update" (null = not choosing). */
  protected readonly picked = signal<ReadonlySet<number> | null>(null);
  protected readonly updateBackup = signal(true);
  /** Connections with an "Update" run started from this page (to offer the restart when it ends). */
  private readonly updating = signal<ReadonlySet<number>>(new Set());
  protected readonly hasUpdate = hasUpdate;
  protected readonly newerVersion = newerVersion;

  protected readonly counts = computed(() => {
    const components = this.overview()?.components ?? [];
    return {
      all: components.length,
      updates: components.filter(hasUpdate).length,
      unwatched: components.filter((c) => c.suggestedRepository !== null).length,
    };
  });

  /** What "Update" can install: updates Home Assistant offers and allows from here, without the operating system. */
  protected readonly updatable = computed(() =>
    (this.overview()?.components ?? []).filter((c) => this.canInstall(c) && c.entityId !== OS_ENTITY_ID),
  );
  protected readonly pickedUpdatable = computed(() => {
    const picked = this.picked();
    return picked ? this.updatable().filter((c) => picked.has(c.id)) : [];
  });
  /** Something is being installed or read right now – "Update" waits. */
  protected readonly anyBusy = computed(
    () =>
      !!this.overview()?.connections.some((c) => c.isChecking || c.isRestarting) ||
      !!this.overview()?.components.some((c) => c.isInstalling),
  );

  protected readonly cards = computed<ConnectionCard[]>(() => {
    const data = this.overview();
    if (!data) return [];
    const filter = this.filter();
    const query = this.query().trim().toLowerCase();
    const matches = (c: HomeAssistantComponent) =>
      (filter === 'all' || (filter === 'updates' ? hasUpdate(c) : c.suggestedRepository !== null)) &&
      (!query || c.name.toLowerCase().includes(query) || c.repositoryName.includes(query));
    const cards = data.connections.map((connection) => ({
      connection,
      components: data.components.filter((c) => c.connectionId === connection.id && matches(c)),
    }));
    return filter === 'all' && !query ? cards : cards.filter((card) => card.components.length > 0);
  });

  /** Something is being read: reload until it finished. */
  private readonly checking = computed(
    () =>
      this.checkingAll() ||
      !!this.overview()?.check.isRunning ||
      !!this.overview()?.connections.some((c) => c.isChecking || c.isRestarting) ||
      !!this.overview()?.components.some((c) => c.isInstalling),
  );

  constructor() {
    effect(() => {
      this.statusService.revision();
      untracked(() => void this.load());
    });
    effect((onCleanup) => {
      // Read the data too: `checking` stays true across a reload, and the effect only runs again when what it read
      // changed – without this it would reload once and then wait forever.
      this.overview();
      if (!this.checking()) return;
      const timer = setTimeout(() => void this.load(), POLL_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  protected async load(): Promise<void> {
    try {
      const overview = await firstValueFrom(this.api.getHomeAssistant());
      this.overview.set(overview);
      this.loadError.set(null);
      this.finishUpdates(overview);
      if (this.checkingAll() && !overview.check.isRunning) {
        this.checkingAll.set(false);
        this.toast.success('Home Assistant checked.');
      }
    } catch (error) {
      this.loadError.set(String((error as { message?: string })?.message ?? error));
      this.checkingAll.set(false);
      this.toast.error(error);
    }
  }

  protected async checkAll(): Promise<void> {
    this.checkingAll.set(true);
    try {
      this.overview.set(await firstValueFrom(this.api.checkHomeAssistant()));
    } catch (error) {
      this.checkingAll.set(false);
      this.toast.error(error);
    }
  }

  /** Watches the repository a component names; the component is linked to it by that name. */
  protected async watch(c: HomeAssistantComponent): Promise<void> {
    const repository = c.suggestedRepository;
    if (!repository) return;
    this.watching.update((s) => new Set(s).add(c.id));
    try {
      await firstValueFrom(this.api.addRepository({ repository, includePrereleases: false }));
      this.toast.success(`Watching ${repository}.`);
      await this.load();
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.watching.update((s) => {
        const next = new Set(s);
        next.delete(c.id);
        return next;
      });
    }
  }

  /** "Update": ticks every update that can be installed; the second step installs the ticked ones. */
  protected startPicking(): void {
    this.updateBackup.set(true);
    this.picked.set(new Set(this.updatable().map((c) => c.id)));
  }

  protected togglePick(id: number): void {
    this.picked.update((s) => {
      const next = new Set(s ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected togglePickAll(): void {
    const all = this.pickedUpdatable().length === this.updatable().length;
    this.picked.set(new Set(all ? [] : this.updatable().map((c) => c.id)));
  }

  /** Installs the ticked updates, one run per connection (Core last, see the server). */
  protected async updatePicked(): Promise<void> {
    const chosen = this.pickedUpdatable();
    this.picked.set(null);
    const byConnection = new Map<number, number[]>();
    for (const c of chosen) byConnection.set(c.connectionId, [...(byConnection.get(c.connectionId) ?? []), c.id]);
    for (const [connectionId, ids] of byConnection) {
      try {
        this.replaceConnection(await firstValueFrom(this.api.installHomeAssistantUpdates(connectionId, ids, this.updateBackup())));
        this.updating.update((s) => new Set(s).add(connectionId));
      } catch (error) {
        this.toast.error(error);
      }
    }
    await this.load();
  }

  /** An "Update" run ended: say so, and offer the restart when integrations or cards wait for one. */
  private finishUpdates(overview: HomeAssistantOverview): void {
    for (const id of this.updating()) {
      const connection = overview.connections.find((c) => c.id === id);
      const running = connection?.isChecking || connection?.isRestarting || overview.components.some((c) => c.connectionId === id && c.isInstalling);
      if (running) continue;
      this.updating.update((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      const failed = overview.components.filter((c) => c.connectionId === id && c.installError);
      if (failed.length > 0) {
        this.toast.error(`${failed.length} update(s) could not be installed – see the components.`);
      } else {
        this.toast.success('Updates installed.');
      }
      if (connection && connection.pendingRestarts.length > 0) {
        this.confirmingRestart.set(connection.id);
      }
    }
  }

  protected readonly supportsBackup = (c: HomeAssistantComponent): boolean => c.supportsBackup;

  protected isUpdatable(c: HomeAssistantComponent): boolean {
    return this.updatable().some((u) => u.id === c.id);
  }

  /** The component being installed on a connection, if any. */
  protected installingOn(connection: HomeAssistantConnection): HomeAssistantComponent | null {
    return this.overview()?.components.find((c) => c.connectionId === connection.id && c.isInstalling) ?? null;
  }

  /** A component whose pending update can be installed from here. */
  protected canInstall(c: HomeAssistantComponent): boolean {
    return c.homeAssistantUpdate && c.installBlocker === null && !c.isInstalling;
  }

  protected askInstall(c: HomeAssistantComponent): void {
    this.backupFirst.set(c.supportsBackup);
    this.confirming.set(c.id);
  }

  /** Installs the version Home Assistant offers; the page reloads until it finished. */
  protected async install(c: HomeAssistantComponent): Promise<void> {
    this.confirming.set(null);
    try {
      const started = await firstValueFrom(this.api.installHomeAssistantComponent(c.id, c.supportsBackup && this.backupFirst()));
      const data = this.overview();
      if (data) {
        this.overview.set({ ...data, components: data.components.map((x) => (x.id === started.id ? started : x)) });
      }
    } catch (error) {
      this.toast.error(error);
    }
  }

  /**
   * A watched repository has a newer release, but Home Assistant has not reported it yet. Offered with installing
   * switched on only: HACS lets administrators alone refresh a repository, and the point is to install it next.
   */
  protected canRefresh(c: HomeAssistantComponent, connection: HomeAssistantConnection): boolean {
    return connection.installEnabled && c.updateAvailable === true && !c.homeAssistantUpdate && !c.isInstalling;
  }

  /** Asks Home Assistant to look for the new version now (it checks on its own schedule otherwise). */
  protected async refresh(c: HomeAssistantComponent): Promise<void> {
    this.refreshing.update((s) => new Set(s).add(c.id));
    try {
      const updated = await firstValueFrom(this.api.refreshHomeAssistantComponent(c.id));
      const data = this.overview();
      if (data) {
        this.overview.set({ ...data, components: data.components.map((x) => (x.id === updated.id ? updated : x)) });
      }
      if (updated.homeAssistantUpdate) {
        this.toast.success(`Home Assistant now offers ${updated.latestVersion}.`);
      } else {
        this.toast.info(`Home Assistant has no update for ${c.name} yet – it may need a while to see the new release.`);
      }
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.refreshing.update((s) => {
        const next = new Set(s);
        next.delete(c.id);
        return next;
      });
    }
  }

  /** Restarts Home Assistant, e.g. to load an updated custom integration; the page reloads until it is back. */
  protected async restart(connection: HomeAssistantConnection): Promise<void> {
    this.confirmingRestart.set(null);
    try {
      this.replaceConnection(await firstValueFrom(this.api.restartHomeAssistant(connection.id)));
    } catch (error) {
      this.toast.error(error);
    }
  }

  private replaceConnection(connection: HomeAssistantConnection): void {
    const data = this.overview();
    if (data) {
      this.overview.set({ ...data, connections: data.connections.map((c) => (c.id === connection.id ? connection : c)) });
    }
  }

  protected async checkConnection(connection: HomeAssistantConnection): Promise<void> {
    try {
      const checking = await firstValueFrom(this.api.checkHomeAssistantConnection(connection.id));
      const data = this.overview();
      if (data) {
        this.overview.set({ ...data, connections: data.connections.map((c) => (c.id === checking.id ? checking : c)) });
      }
    } catch (error) {
      this.toast.error(error);
    }
  }
}
