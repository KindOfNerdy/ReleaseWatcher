import { Injectable, signal } from '@angular/core';
import { describeError } from './api.service';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

/** Global, auto-dismissing notifications rendered by the app shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(text: string): void {
    this.push('success', text);
  }

  info(text: string): void {
    this.push('info', text);
  }

  error(error: unknown): void {
    this.push('error', typeof error === 'string' ? error : describeError(error), 8000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], text: string, durationMs = 4000): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
