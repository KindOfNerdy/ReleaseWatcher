import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AppStatus } from './models';
import { ToastService } from './toast.service';

/** Poller status shared by the sidebar and pages. */
@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly status = signal<AppStatus | null>(null);
  readonly checkingAll = signal(false);
  /** Incremented after "check all" so pages can reload their data. */
  readonly revision = signal(0);

  async refresh(): Promise<void> {
    try {
      this.status.set(await firstValueFrom(this.api.getStatus()));
    } catch {
      // The sidebar keeps showing the previous status; pages report their own errors.
    }
  }

  async checkAll(): Promise<void> {
    if (this.checkingAll()) {
      return;
    }
    this.checkingAll.set(true);
    try {
      this.status.set(await firstValueFrom(this.api.checkAll()));
      this.revision.update((r) => r + 1);
      this.toast.success('All repositories checked.');
    } catch (error) {
      this.toast.error(error);
    } finally {
      this.checkingAll.set(false);
    }
  }
}
