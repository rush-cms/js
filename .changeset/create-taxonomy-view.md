---
'create-rush-cms': minor
---

The template renders category and tag listings: `src/views/taxonomy.astro` (`TaxonomyViewProps`), dispatched by
`src/pages/[...path].astro` once `taxonomies` is set in `astro.config.ts`. Collection and taxonomy lists share
`src/components/list-page.astro`, which renders `hreflang` links on page 1, and a taxonomy listing's language switcher
points at the same category or tag in the other locales. Bundles `@rushcms/client` 4.1.0 and `@rushcms/astro` 0.3.0.
