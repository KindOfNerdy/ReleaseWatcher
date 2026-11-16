import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Accessible toggle switch. */
@Component({
  selector: 'app-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      class="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="toggled.emit()"
    >
      <span class="thumb"></span>
    </button>
    @if (showLabel()) {
      <span class="text" (click)="!disabled() && toggled.emit()">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--text-muted);
      user-select: none;
    }
    .text {
      cursor: pointer;
      white-space: nowrap;
    }
    .switch {
      position: relative;
      width: 34px;
      height: 20px;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: var(--border-strong);
      cursor: pointer;
      transition: background 0.15s;
    }
    .switch[aria-checked='true'] {
      background: var(--accent);
    }
    .switch:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .switch:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
      transition: transform 0.15s;
    }
    .switch[aria-checked='true'] .thumb {
      transform: translateX(14px);
    }
  `,
})
export class Switch {
  readonly checked = input.required<boolean>();
  readonly label = input.required<string>();
  readonly showLabel = input(true);
  readonly disabled = input(false);
  readonly toggled = output<void>();
}
