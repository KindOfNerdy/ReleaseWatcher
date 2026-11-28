import { Injectable, computed, inject, signal } from '@angular/core';
import { ALWAYS_SHOWN, DEFAULT_NAV_ORDER, NAV_PAGES, NavPage, NavPageId } from './nav-pages';
import { PreferencesService } from './preferences.service';

/** Order and visibility of the sidebar pages (saved per browser) and the sidebar's rearrange mode. */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly preferences = inject(PreferencesService);

  /** The sidebar is in rearrange mode: items wiggle, can be dragged and do not navigate. */
  readonly editing = signal(false);
  readonly pages = computed(() =>
    this.preferences.navOrder().map((id) => NAV_PAGES.find((p) => p.id === id) as NavPage),
  );
  /** The pages shown in the sidebar: all but the hidden ones, in order. */
  readonly visiblePages = computed(() => {
    const hidden = this.preferences.hiddenPages();
    return this.pages().filter((p) => !hidden.includes(p.id));
  });
  /** Where `/` (and signing in without a return URL) leads: the first page shown in the sidebar. */
  readonly home = computed(() => this.visiblePages()[0]?.id ?? DEFAULT_NAV_ORDER[0]);
  readonly isDefault = computed(() =>
    this.preferences.navOrder().every((id, i) => id === DEFAULT_NAV_ORDER[i]),
  );

  /** Moves the page at `from` to `to` (indexes are clamped). */
  move(from: number, to: number): void {
    const order = [...this.preferences.navOrder()];
    const target = Math.max(0, Math.min(order.length - 1, to));
    if (from === target || from < 0 || from >= order.length) return;
    const [id] = order.splice(from, 1);
    order.splice(target, 0, id as NavPageId);
    this.preferences.navOrder.set(order);
  }

  isHidden(id: NavPageId): boolean {
    return this.preferences.hiddenPages().includes(id);
  }

  /** Hides a page from the sidebar or shows it again (Settings always stays). */
  toggleHidden(id: NavPageId): void {
    if (id === ALWAYS_SHOWN) return;
    this.preferences.hiddenPages.update((hidden) =>
      hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id],
    );
  }

  reset(): void {
    this.preferences.navOrder.set([...DEFAULT_NAV_ORDER]);
  }
}
