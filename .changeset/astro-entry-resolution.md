---
'@rushcms/astro': minor
---

Adds `resolveEntry(Astro, route?)` for entry pages that work both prerendered (from `getStaticPaths` props) and on
demand (the preview deployment): it returns `found` with the entry and locale, `moved` with a redirect location built
without a second request and `permanent` (`false` in a preview deployment, so pages answer `302` there), or `missing`
for `not_found`, `not_translated`, `locale_not_served` and unknown locale segments. A collection that names a
fixed-collection route (a collection id or any locale's slug whose pattern has no `{collection}`, such as
`/{locale}/blog/{slug}`) is mapped to the slug of the page's locale before the request, so the route resolves in
every locale; the same collection reached as a `collection` route param answers `moved` to the fixed route; a
`{collection}` segment is sent as is so the API can answer `moved`. `entryPaths` and
`sitemapResponse` accept the same keys.

Adds `getUrls(Astro)`, the client URL helpers built from the `rush()` options and the site's collections of every
locale (fetched at build and dev start). A `[locale]` route param now matches `localePaths` prefixes only and wins
over `Astro.currentLocale`, which still matches prefixes and CMS codes; the integration middleware answers `404` for a
`locale` param that matches no prefix. `RushImage` renders a plain
`<img loading="lazy" decoding="async">` while a media entry has no dimensions instead of nothing, and rich text
images render through it.

Exported types: `RushAstroOptions`, `SeoFieldMap`, `RushContext`, `EntryResolution`, `EntryFound`, `EntryMoved`,
`EntryMissing`, `EntryRoute`, `EntryRouteContext`, `EntryRouteProps`, `EntryStaticPath`, `SitemapContext` and
`SitemapOptions`.
