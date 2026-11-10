# @rushcms/astro

## 0.3.0

### Minor Changes

- [`3cee317`](https://github.com/rush-cms/js/commit/3cee3179e14a1fd579152890c87ebf4a0b604fa6) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Category and tag listing pages.
  
  - `taxonomies` option of `rush()`: `category` and `tag` map to a path segment per locale (validated at config load,
    route clashes at build and dev start; see the README "Taxonomies" section).
  - `sitePaths()` lists every page of every tag with `entry_count > 0`, per configured type and locale, with entries
    from `tags.entries` restricted to the tag's type; `resolvePage` answers those paths on demand as `{ kind:
  'taxonomy', locale, tag, page, lastPage, entries, alternates }` (`TaxonomyPage`, `TaxonomyEntryPage`), and
    `missing` for an unknown or empty tag or a page past the last. `alternates` is the same tag in every locale where
    it has entries. `SitePage` gains that member, so an exhaustive `switch` over `page.kind` needs a `taxonomy` case.
    A dispatcher that chains `page.kind === …` checks renders an empty `200` page for a taxonomy URL: add its
    `taxonomy` line before setting `taxonomies`.
  - `taxonomyAlternates(tag, client, urls)` returns those alternates outside the dispatcher.
  - `<Hreflang alternates>` (`@rushcms/astro/components/hreflang.astro`) emits `<link rel="alternate" hreflang>` for a
    list of alternates, with absolute URLs and `x-default` for the default locale; `<Seo>` renders its links through it.
  - `sitemapResponse` lists page 1 of every taxonomy listing, with alternates to the same tag in the other locales and
    `x-default`.

### Patch Changes

- Updated dependencies [[`3cee317`](https://github.com/rush-cms/js/commit/3cee3179e14a1fd579152890c87ebf4a0b604fa6)]:
  - @rushcms/client@4.1.0

## 0.2.0

### Minor Changes

- [`7e108ff`](https://github.com/rush-cms/js/commit/7e108ff8734f2ac6992121fed3c4d4fb093d1645) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Breaking (0.x minor): URLs come only from `routes` and `localePaths`, and the sitemap lists what the dispatcher
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

### Patch Changes

- Updated dependencies [[`7e108ff`](https://github.com/rush-cms/js/commit/7e108ff8734f2ac6992121fed3c4d4fb093d1645)]:
  - @rushcms/client@4.0.0

## 0.1.0

### Minor Changes

- [`dac47f7`](https://github.com/rush-cms/js/commit/dac47f72a776b74b974a32a8138825e58644d4ab) Thanks [@rmarsigli](https://github.com/rmarsigli)! - First release of `@rushcms/astro`, the Astro integration for Rush CMS v2, built on `@rushcms/client` 3. It needs
  Astro 7.4 or later and the Node adapter (`@astrojs/node`) for the on-demand routes; pages stay static unless you opt
  out.
  
  - `rush({ localePaths, trustedProxies, routes?, seo? })` declares the `astro:env` schema (`RUSH_API_URL`,
    `RUSH_SITE_ID`, `RUSH_API_TOKEN` as a secret that never reaches the client bundle or the build output,
    `RUSH_MEDIA_URL`, `RUSH_PREVIEW`), allows the media host for `astro:assets`, and at build and dev start checks that
    `localePaths` lists exactly the site's locales and loads the collections of every locale.
  - `getRush(Astro)` returns a client bound to the page's locale (memoized per locale during static builds) and
    `getUrls(Astro)` the URL helpers of `@rushcms/client` built from the options. The integration middleware answers
    `404` for a `locale` route param that is no `localePaths` prefix.
  - Entry pages: `entryPaths(collection)` for `getStaticPaths` in every locale, fallback pages included, and
    `resolveEntry(Astro, route?)`, which returns `found`, `moved` (a redirect location built from the error params,
    `302` in a preview deployment) or `missing`, so one page file works prerendered and on demand, with fixed-collection
    routes in every locale.
  - `sitemapResponse` serves an XML sitemap of canonical URLs with `lastmod` and hreflang alternates.
  - Components: `<RichText>` (TipTap rich text with site block and node components, safe links), `<RushImage>`
    (`astro:assets` image from the media map), `<Seo>` (title, description, Open Graph, canonical, hreflang), `<Form>`
    (fields from the public form schema, Turnstile, per-field errors, works without JavaScript) and `<PreviewBanner>`.
  - `POST /_rush/forms/[key]` forwards urlencoded, multipart and JSON posts with the captcha token, answers JSON to
    `fetch` and `303` to plain form posts, and sends the visitor IP for the API rate limits without ever trusting an
    address the visitor chose. `trustedProxies` is required and has no default: `0` when visitors reach the Node server
    directly, `n` behind `n` reverse proxies that append to `X-Forwarded-For`; config setup fails without it, and a form
    post whose `X-Forwarded-For` does not fit the count logs a warning once per process. The README lists the values
    for Coolify, nginx and Cloudflare and the lockdown each hop needs.
  - Preview deployment: the same site built with `RUSH_PREVIEW=true` renders every route on demand with
    `X-Robots-Tag: noindex`, turns CMS preview links (`/_rush/preview`) into an `HttpOnly` cookie session that reads
    drafts, and exits through `/_rush/preview/exit`.

### Patch Changes

- Updated dependencies [[`dac47f7`](https://github.com/rush-cms/js/commit/dac47f72a776b74b974a32a8138825e58644d4ab)]:
  - @rushcms/client@3.0.0
