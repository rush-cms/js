# @rushcms/astro

## 0.7.1

### Patch Changes

- [`053ce0d`](https://github.com/rush-cms/js/commit/053ce0de894d3c4b61dbeda68b651441907ba84f) Thanks [@rmarsigli](https://github.com/rmarsigli)! - The homepage SEO helpers read `meta` as the always-present object the contract now declares; output is unchanged.
- Updated dependencies [[`053ce0d`](https://github.com/rush-cms/js/commit/053ce0de894d3c4b61dbeda68b651441907ba84f)]:
  - @rushcms/client@5.0.3

## 0.7.0

### Minor Changes

- [`9bc74ad`](https://github.com/rush-cms/js/commit/9bc74ad31579395db99e89b5333687061bc12732) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `@rushcms/astro/components-runtime` and `@rushcms/astro/form-enhance` are no longer exported: they were internal helpers of the shipped components and are now private `#components-runtime` and `#form-enhance` imports. Code that imported them directly must stop; nothing documented used them.

### Patch Changes

- [`3ef4aba`](https://github.com/rush-cms/js/commit/3ef4abaf04d1973f1917a87560e6ea9440f7cc72) Thanks [@rmarsigli](https://github.com/rmarsigli)! - A locale whose homepage is `not_translated` still renders and lists no homepage, now that `optional` rethrows that error.

- [`df11628`](https://github.com/rush-cms/js/commit/df11628c20c5044e43dd588fb0b010a1faa93c85) Thanks [@rmarsigli](https://github.com/rmarsigli)! - A mapped SEO image field that is empty or missing now falls back to the entry's featured image, like the title and description fields.
- Updated dependencies [[`3ef4aba`](https://github.com/rush-cms/js/commit/3ef4abaf04d1973f1917a87560e6ea9440f7cc72)]:
  - @rushcms/client@5.0.2

## 0.6.1

### Patch Changes

- [`08c7855`](https://github.com/rush-cms/js/commit/08c7855d314002269bc519b0d6074f3b059d7431) Thanks [@rmarsigli](https://github.com/rmarsigli)! - The error for a route whose `locale` param matches no `localePaths` prefix now names the route, the value and the configured prefixes, says that `locale` is the param name reserved for the locale prefix and suggests renaming it. A prerendered route fails the build with it instead of getting a silent 404.
- Updated dependencies [[`287358d`](https://github.com/rush-cms/js/commit/287358d6b96742de4a801aaa5d84fac9972a353e)]:
  - @rushcms/client@5.0.1

## 0.6.0

### Minor Changes

- [`ea216eb`](https://github.com/rush-cms/js/commit/ea216eb6dc5a9c1215340c19bc80455ecefa72a4) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Breaking for TypeScript users: nested field values are typed. The API contract now describes `Entry['data']`, homepage section values, site option group values, Block values and rich-text custom block values with named schemas instead of free objects, and the generated types follow. Runtime behaviour does not change.
  
  Existing code that compiled against the free-object types can stop compiling:
  
  - A field value is a `FieldValue` (string, number, boolean, string list, `RichText`, database items, repeater items or a Block value) instead of `unknown`; narrow it before use, and values you construct for typed fixtures must match.
  - A repeater item requires a string `_id`, and repeaters nest at most one level (`NestedRepeaterItem`); items without `_id` no longer type-check.
  - A database field value is an array of `ExpandedDatabaseItem` (`id`, `name`, `description`, `parent_id`), also for single-choice fields.
  - Block values cannot contain block fields.
  - Admin field widths are no longer served on public Block definitions.
  
  New exported types: `FieldValue`, `FieldValues`, `BlockValue`, `BlockValues`, `RepeaterItem`, `NestedRepeaterItem`, `ExpandedDatabaseItem`. `@rushcms/astro` moves its `@rushcms/client` range to the new major, so sites typed against the old client types may need the same adjustments.

### Patch Changes

- [`fbdfd43`](https://github.com/rush-cms/js/commit/fbdfd43999d77583a5de4a79feaeb6a21d344069) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `RushImage` probes remote image sizes with its own request that is aborted when the probe deadline expires, reads only the bytes needed for the dimensions and cancels the body, instead of leaving a stalled request running.

- [`fbdfd43`](https://github.com/rush-cms/js/commit/fbdfd43999d77583a5de4a79feaeb6a21d344069) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `trustedProxies` is required only when the integration serves on-demand routes (forms enabled or a preview deployment) and is optional and ignored on a static site; the option only becomes optional, so existing configs keep working. `create-rush-cms --ssg` no longer writes it.
- Updated dependencies [[`ea216eb`](https://github.com/rush-cms/js/commit/ea216eb6dc5a9c1215340c19bc80455ecefa72a4)]:
  - @rushcms/client@5.0.0

## 0.5.1

### Patch Changes

- [`6ce573c`](https://github.com/rush-cms/js/commit/6ce573c9790f6e138efe2bfccf81f4005cd4af0c) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Docs: a prefixed `404.astro` builds to `dist/<prefix>/404/index.html` with Astro's default build format, not `dist/<prefix>/404.html`; the nginx examples point there.

## 0.5.0

### Minor Changes

- [`8ee296a`](https://github.com/rush-cms/js/commit/8ee296a103a6247b291d60edd869643f394840bb) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Add the `forms` option: `forms: false` stops injecting the on-demand `/_rush/forms/[key]` route, for sites built without an adapter.

## 0.4.0

### Minor Changes

- [`4edd89b`](https://github.com/rush-cms/js/commit/4edd89b13eac94e2b767feb1c006fde8316d2e84) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `<Seo page>` emits the same head as the entry and homepage forms for any other page, such as a collection list or a taxonomy page (`locale`, `canonical`, `title`, `description`, `alternates`, `image`). Every form now emits the Twitter card tags, takes `titleSuffix` (appended to `<title>` only) and writes `og:locale` and `og:locale:alternate` in the Open Graph form (`pt_BR`). `RushImage` is responsive: it emits `srcset` and `sizes` on the media host, takes `layout`, `widths`, `priority` and `aspectRatio`, reads the size of a media without dimensions from the image itself and reserves an aspect box when it cannot. The sitemap no longer lists a collection list page in a locale whose listing is empty.
  
  Markup change for existing `RushImage` users on the media host: images now default to Astro's `constrained` layout, so they carry `srcset`, `sizes` and the `data-astro-image` attributes, their transform URLs add `fit=cover`, a static build generates one variant per width (up to nine per image), and with `image.responsiveStyles: true` Astro's responsive CSS applies to them. Pass `layout="none"` to keep the 0.3 markup. `SeoPage` and `ImageLayout` are exported from `@rushcms/astro`. The undocumented internal subpath `@rushcms/astro/components-runtime` no longer exports `entrySeo`, `homepageSeo`, `SeoSettings`, `SeoTags` or `SeoImage`.

## 0.3.1

### Patch Changes

- [`a9b3a46`](https://github.com/rush-cms/js/commit/a9b3a46a556a6a66a91ec61e6935f1a154fab6b0) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `x-default` now points at the locale served at the site root (the empty URL prefix) when there is one, and at the CMS default locale otherwise.

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
