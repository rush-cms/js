---
'create-rush-cms': minor
---

The template renders category and tag listings: `src/views/taxonomy.astro` (`TaxonomyViewProps`), dispatched by
`src/pages/[...path].astro` once `taxonomies` is set in `astro.config.ts`. Collection and taxonomy lists share
`src/components/list-page.astro`, which renders `<Hreflang>` on page 1, and a taxonomy listing's language switcher
points at the same category or tag in the other locales. An existing site copies the `taxonomy` line of the dispatcher
and `src/views/taxonomy.astro` before setting `taxonomies`; without that line a taxonomy URL renders an empty `200`
page. Bundles `@rushcms/client` 4.1.0 and `@rushcms/astro` 0.3.0.
