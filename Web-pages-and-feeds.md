# Web pages and feeds

Not every project publishes releases on GitHub, Gitea/Forgejo or GitLab. ReleaseWatcher can also read versions from a
**web page**, an **RSS/Atom feed** or a **JSON API** and treat them like releases: they show up on the
[[Repositories]] page, are compared with the installed version and are announced by your [[Notifications]].

A web source is a repository with the provider `web`: its host is the host of the URL, its owner is `web` and its name is
the display name you give it. Security advisories, tokens and the *Watch: Tags* choice don't apply to it – for
vulnerabilities set an [[OSV.dev package|Vulnerabilities]].

## Setting up a source

| Field | Meaning |
| --- | --- |
| **Name** | Display name on the Repositories page and in notifications (unique per host, without `/`) |
| **URL** | Page, feed or API that lists the versions (`https://…`) |
| **Format** | **Text**, **JSON**, **HTML** or **XML** – you choose it; the **RSS feed** and **Atom feed** presets set XML and fill in the locators |
| **Items** selector / path | The entries, one per release, e.g. the `item` elements of a feed. Empty = no grouping: every element or value that matches *Version* is one release |
| **Version** selector / path | The version inside an entry. Empty = the entry's own text |
| **Date** selector / path | The publication date inside an entry (optional) |
| **Link** selector / path | The entry's link (optional; the URL of the source otherwise) |
| **Version pattern** | Regular expression that picks the version – required for *Text*, optional otherwise |
| **User-Agent** | Behind *Blocked by the site? Set a User-Agent* – overrides the default for this source only |

The locators are called *selector* for HTML and XML and *path* for JSON. *Text* ignores them: the whole response is
searched with the version pattern.

**Test** fetches the URL and shows a preview: the content type, the format the response looks like (with *Use <format>*
when it differs from the chosen one), the size, how the newest version is chosen and the releases found (version,
title, date, link, pre-release) – up to 50, with the newest marked. Nothing is saved.

A web source can be renamed and get another URL later. Changing the URL, a locator or the version pattern stores a new
baseline right away **without notifying**; changing only the User-Agent does not. Its key (`host/web/name`, used e.g.
by [[Docker labels|Docker containers]]) follows the name and the host, so update labels after a rename.

### Locators

*Version*, *Date* and *Link* are relative to an entry of *Items*:

- **HTML and XML:** CSS selectors, e.g. `dt a.gdoc-props__title`. `> title` selects a direct child. Namespaced feed
  elements are written as they appear, e.g. `media:title`.
- **Attributes are preferred where they exist:** a date is read from `datetime` (e.g. `<time datetime="…">`) before
  the text, a link from `href`.
- **Lists:** *Date* and *Link* may list several selectors, e.g. `published, updated` – the first selector that finds
  something in the entry wins, wherever its element is.
- **JSON:** a dot path, with `[n]` for one array element and `[*]` for all of them, e.g. `releases[*]` as *Items* and
  `name` as *Version*.

### Feed presets

The **RSS feed** and **Atom feed** presets set the format to XML and fill in the locators of standard feeds:

| Preset | Items | Version | Date | Link |
| --- | --- | --- | --- | --- |
| RSS feed | `item` | `title` | `pubDate` | `link` |
| Atom feed | `entry` | `title` | `published, updated` | `link` |

The title of a feed entry is usually more than a version (`AMP v2.6.2.4 Release Notes`), so add a version pattern.
Without one, an entry counts only when its text holds a dotted version (`2.1.0`, `v3.0.2 Release Notes`); texts like
`28 Nightlies` or a year are skipped.

## Version pattern

The same rules as for [Repositories → Version pattern](Repositories#version-pattern): a regular expression, case-insensitive; the named
group `version` (`(?<version>…)`), else group 1, else the whole match is the version. Entries that don't match are
skipped. A pre-release suffix right after the group is kept: `Latest:\s*([\d.]+)` on `Latest: 27-RC.1` gives
`27-RC.1`, a pre-release. A pattern that runs longer than **2 seconds** is stopped and reported as the check error.

## How the newest version is chosen

- With a **Date** locator, by **date** – like releases; entries of the same date by version. An entry whose date is
  missing or unreadable is left out until it has one.
- Without one (and always for *Text*), by the **highest version** – like tags; patch levels such as `p21` or `-U5` count
  as an extra number.

The first check only stores the newest version as the baseline; later checks announce what is newer (max 5 per check).

## Being a polite client

- Web sources are checked on the normal release schedule (`RELEASE_CHECK_CRON`, default every 15 minutes) – never more
  often – and with *Check* / *Check all now*.
- Requests are conditional (`If-None-Match` / ETag and `If-Modified-Since` / `Last-Modified`), so an unchanged page
  costs the site a `304`.
- Responses are limited to **5 MB** and **20 seconds**.
- The default User-Agent is `ReleaseWatcher/<version> (+https://github.com/Rozumek29/ReleaseWatcher)`. Change it for
  one source only when a site blocks it (a `403`/`429` answer says *The site may block automated requests*).
- The page is decoded with the `charset` of its `Content-Type` (UTF-8 otherwise).

The server fetches whatever URL you enter, also addresses in your LAN – handy for internal pages; only signed-in users
and API tokens with full access can add or preview sources.

## Examples

**AMP (CubeCoders) – Discourse RSS feed**

| Field | Value |
| --- | --- |
| URL | `https://discourse.cubecoders.com/c/news/6.rss` |
| Format | **RSS feed** preset |
| Version pattern | `v(\d+\.\d+\.\d+) Release Notes` |

Posts that aren't release notes don't match and are skipped.

**TrueNAS – software status page (HTML)**

| Field | Value |
| --- | --- |
| URL | `https://www.truenas.com/docs/softwarestatus/` |
| Format | HTML |
| Version selector | `dt a.gdoc-props__title` |

The page lists every version of every branch; without a pattern only dotted versions count and pre-releases
(`24.10-RC.2`) are skipped unless *Include pre-releases* is on, so the newest is the latest stable one. Or use the format
*Text* with the version pattern `Latest:\s*([\d.]+)` – only the latest version of each branch (`27-RC.1` counts as a
pre-release).

**UniFi Network Application – download page (text)**

| Field | Value |
| --- | --- |
| URL | `https://www.ui.com/download` |
| Format | Text |
| Version pattern | `UniFi Network Application (\d+\.\d+\.\d+)` |

## Related

- [[Repositories]] – releases, tags and the version pattern.
- [[REST API]] – `POST /api/repositories` with a `webSource`, `POST /api/web-sources/preview`.
- [[Troubleshooting]] – when a check fails.
