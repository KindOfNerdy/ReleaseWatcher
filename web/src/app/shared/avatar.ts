import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Owner avatar with a lettered fallback when the image can't be loaded (e.g. offline). */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.--size.px]': 'size()' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" alt="" loading="lazy" decoding="async" [width]="size()" [height]="size()" (error)="failed.set(true)" />
    } @else {
      <span class="fallback">{{ initial() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-grid;
      flex-shrink: 0;
      width: var(--size);
      height: var(--size);
      border-radius: 10px;
      overflow: hidden;
      background: var(--surface-2);
      box-shadow: inset 0 0 0 1px var(--border);
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fallback {
      display: grid;
      place-items: center;
      color: var(--text-muted);
      font-weight: 650;
      font-size: calc(var(--size) * 0.42);
      text-transform: uppercase;
    }
  `,
})
export class Avatar {
  readonly src = input<string | null>(null);
  readonly name = input('');
  readonly size = input(36);

  protected readonly failed = signal(false);
  protected readonly initial = computed(() => this.name().charAt(0) || '?');
}
