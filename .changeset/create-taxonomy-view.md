---
'create-rush-cms': minor
---

The template renders category and tag listings: `src/views/taxonomy.astro` (`TaxonomyViewProps`), dispatched by
`src/pages/[...path].astro` once `taxonomies` is set in `astro.config.ts`. Collection and taxonomy lists share
`src/components/list-page.astro`. Bundles `@rushcms/client` 4.1.0 and `@rushcms/astro` 0.3.0.
