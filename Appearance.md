# Appearance

**Settings → Appearance** changes how the UI looks. All settings are **saved in this browser only** (local storage) –
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

## Sidebar

Put the pages of the sidebar in the order you like. The **first page is the start page**: it opens after signing in and
when you open the address without a path (`/`) or an unknown one. A link to a page (e.g. `/machines`) always opens that
page.

1. *Rearrange sidebar* puts the sidebar into edit mode – the pages wiggle (on a phone the menu opens).
2. Drag a page to its place with the mouse or a finger. On short screens, hold it near the top or bottom edge and the
   sidebar scrolls. With the keyboard, focus a page and move it with ↑ / ↓, *Home* (to the top) or *End*.
3. *Done* (or Esc) ends edit mode; *Reset order* restores the default (Repositories, Machines, Docker,
   Vulnerabilities, Settings).

The section shows the current order with the start page marked. Like the other settings, the order applies to this
browser only – set it on each device. A backup from *Settings → Backup* that includes the appearance carries it too.

## Other per-browser preferences

Also remembered in the browser:

- the **Repositories** layout (list or grid),
- the sort order of the **Machines** page.

## Motion

Animations are short and subtle. If your OS has *reduce motion* enabled, all animations and transitions are switched
off.

## Resetting

Clear the site data of ReleaseWatcher in your browser – or simply pick *System* and *Indigo* again and use
*Reset order* for the sidebar.
