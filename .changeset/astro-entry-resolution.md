---
'@rushcms/astro': minor
---

Adds `resolveEntry(Astro, route?)` for entry pages that work both prerendered (from `getStaticPaths` props) and on
demand (the preview deployment): it returns `found` with the entry and locale, `moved` with a redirect location built
without a second request, or `missing` for `not_found`, `not_translated`, `locale_not_served` and unknown locale
segments. Exports the `EntryResolution`, `EntryRoute`, `EntryRouteContext` and `EntryRouteProps` types.
