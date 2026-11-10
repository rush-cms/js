---
'@rushcms/astro': minor
---

Category and tag listing pages.

- `taxonomies` option of `rush()`: `category` and `tag` map to a path segment per locale (validated at config load,
  route clashes at build and dev start; see the README "Taxonomies" section).
- `sitePaths()` lists every page of every tag with `entry_count > 0`, per configured type and locale, with entries
  from `tags.entries`; `resolvePage` answers those paths on demand as `{ kind: 'taxonomy', locale, tag, page,
lastPage, entries }` (`TaxonomyPage`, `TaxonomyEntryPage`), and `missing` for an unknown or empty tag or a page past
  the last. `SitePage` gains that member, so an exhaustive `switch` over `page.kind` needs a `taxonomy` case.
- `sitemapResponse` lists page 1 of every taxonomy listing, with alternates to the same tag in the other locales and
  `x-default`.
