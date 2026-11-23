# Appearance

**Settings → Appearance** changes how the UI looks. Both settings are **saved in this browser only** (local storage) –
not on the server – so every device can have its own.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/appearance-dark.png">
  <img src="https://github.com/Rozumek29/ReleaseWatcher/raw/main/docs/images/appearance-light.png" alt="Appearance settings" width="450">
</picture>

## Theme

| Option | Behaviour |
| --- | --- |
| **System** (default) | follows the operating system's light/dark setting, live |
| **Light** | always light |
| **Dark** | always dark |

The theme is applied before the first paint, so there's no flash of the wrong theme on load.

## Accent colour

Used for buttons, links, switches and the active page. Presets:

**Indigo** (default, Discord-like `#5865f2`), **Blue**, **Teal**, **Green**, **Orange**, **Rose**, **Violet**.

Each preset has its own light and dark tones chosen for readable contrast (WCAG AA). A preview shows a button, a badge
and a link.

## Other per-browser preferences

Also remembered in the browser:

- the **Repositories** layout (list or grid),
- the sort order of the **Machines** page.

## Motion

Animations are short and subtle. If your OS has *reduce motion* enabled, all animations and transitions are switched
off.

## Resetting

Clear the site data of ReleaseWatcher in your browser – or simply pick *System* and *Indigo* again.
