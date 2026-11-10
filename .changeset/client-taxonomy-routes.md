---
'@rushcms/client': minor
---

Taxonomy listing URLs for categories and tags.

- `createUrls({ taxonomies })`: `category` and `tag` map to a path segment per locale. Each segment must be non-empty
  and free of `/`, exist for every `localePaths` locale and only for those, and, for the `''` prefix locale, differ
  from every other locale's prefix. With `collections`, a segment whose URLs a route already produces throws
  `routes "<key>" and "taxonomies.<type>" produce the same URLs` (also between the two types).
- `urls.taxonomy(tag, locale, page?)` builds `/<prefix>/<segment>/<slug>`, plus `/<pageSegment>/<n>` for page `n > 1`,
  from a `Tag` or a `TagRef`; `undefined` when the type has no segment. `urls.taxonomyTypes` lists the configured
  types.
- `urls.match` answers `{ kind: 'taxonomy', locale, type, slug, page }` (`TaxonomyMatch`) for those paths.
- New exported types: `RushTaxonomies`, `RushTaxonomySegments`, `TaxonomyMatch`, `TagRef`, `TagType`.
