---
'@rushcms/astro': minor
---

Breaking (0.x minor): URLs come only from `routes` and `localePaths`, and the sitemap lists what the dispatcher
renders. Built on `@rushcms/client` 4.

Breaking changes and how to migrate:

- Unrouted collections have no URL. Declare `routes` in `rush()`; `routes: { '*': '/{locale}/{collection}/{slug}' }`
  restores the previous generic shape. `resolveEntry` answers `missing` for a collection without a route (and for a
  `moved` answer whose target collection has none), `entryPaths` throws before any request, and `sitemapResponse`
  lists routed collections only and throws when an explicit `collections` name has no route.
- Route mistakes fail when Astro loads the config or the site starts (`route "<key>" matches no collection`, a
  missing `{locale}`, ambiguous prefixes and slugs, two routes producing the same URLs; see the client changelog for
  the full list), not at render time.
- The sitemap contents changed: it lists the homepage of each locale that has its own CMS homepage (not a fallback,
  with `lastmod`), or the front page of every locale when the site has no CMS homepage at all; page 1 of every listed
  collection in every locale it exists in (unless its URL is a homepage URL); and canonical entries, each with hreflang
  alternates among the listed pages and `x-default` when the default locale's page is listed. Later list pages are
  never listed.
- `RushContext` now requires `url` (`Astro.url`). Custom contexts built for `getRush`, `getUrls`, `resolveEntry` or
  `sitemapResponse` must pass it; Astro's own `Astro`/`APIContext` already does.
- Locale resolution gained a request-path step: without a `locale` param or `Astro.currentLocale` (a `[...path]`
  dispatcher, `404.astro`, `/sitemap.xml`), the locale is that of `urls.match(Astro.url.pathname)`, else the locale
  whose prefix is the first path segment, else the `''` prefix, else the site's default. Before, such pages always got
  the `''` or default locale.
- `isRecord` comes from `@rushcms/client/internal`; the astro package no longer carries its own copy.
- The package declares `"engines": { "node": ">=24" }`, as the README always required.
- Recommended setup: the dispatcher route (`src/pages/[...path].astro` with `export * from '@rushcms/astro/site-paths'`
  plus an on-demand `404.astro`). One page per URL shape (`resolveEntry` with `entryPaths`) stays valid only when every
  locale has a prefix; with a `''` prefix the shapes are ambiguous on demand. The README's "Dispatcher route" section
  has the files.

Additions:

- `getNavigation(Astro, key)`: the navigation `key` in the page's locale as `NavigationLink[]` (`navigationLinks` with
  `getUrls(Astro)`); pair it with `optional` from the client for sites that may not have it yet.
- `getLocale(Astro)`: the locale a page resolves to, for `<html lang>` or a home link on a `404` page.
- `sitePaths(rush?)` and `resolvePage(Astro)`, with the `SitePage*` types: the static paths of every homepage, list
  page and entry, and one resolution (`homepage`, `collection`, `found`, `moved`, `missing`) for the dispatcher. A URL
  is listed once; list pages come from the collection's `items_per_page`, and a `collection` page carries
  `lastPage` (`meta.last_page`, at least 1) for pagination.
- `@rushcms/astro/site-paths`: exports `getStaticPaths` alone. Re-exporting it with `export *` keeps preview builds
  (`RUSH_PREVIEW=true`, every route on demand) free of the `getStaticPaths() ignored` warning.
- `pageSegments` option of `rush()`: the segment of list pages after the first, per locale (default `page`).
- The `localePaths` mismatch error now prints a paste-ready line: the default locale gets `''`, every other locale its
  lower-case language subtag, or its full lower-case code with `-` (`pt-br`) when two locales share the subtag.
- `homepageAlternates(urls)` and `collectionAlternates(collection, urls)`: the alternates the sitemap uses, for
  language switchers.
- `homepageTitle(homepage)`: the `<title>` `<Seo homepage>` emits, `undefined` when `meta.title` is missing or blank.
