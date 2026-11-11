# create-rush-cms

## 0.2.1

### Patch Changes

- [`a9b3a46`](https://github.com/rush-cms/js/commit/a9b3a46a556a6a66a91ec61e6935f1a154fab6b0) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Scaffolded sites pick up the new `@rushcms/astro` `x-default` rule: the locale served at the site root, else the CMS default locale.

## 0.2.0

### Minor Changes

- [`3cee317`](https://github.com/rush-cms/js/commit/3cee3179e14a1fd579152890c87ebf4a0b604fa6) Thanks [@rmarsigli](https://github.com/rmarsigli)! - The template renders category and tag listings: `src/views/taxonomy.astro` (`TaxonomyViewProps`), dispatched by
  `src/pages/[...path].astro` once `taxonomies` is set in `astro.config.ts`. Collection and taxonomy lists share
  `src/components/list-page.astro`, which renders `<Hreflang>` on page 1, and a taxonomy listing's language switcher
  points at the same category or tag in the other locales. An existing site copies the `taxonomy` line of the dispatcher
  and `src/views/taxonomy.astro` before setting `taxonomies`; without that line a taxonomy URL renders an empty `200`
  page. Bundles `@rushcms/client` 4.1.0 and `@rushcms/astro` 0.3.0.

## 0.1.0

### Minor Changes

- [`7e108ff`](https://github.com/rush-cms/js/commit/7e108ff8734f2ac6992121fed3c4d4fb093d1645) Thanks [@rmarsigli](https://github.com/rmarsigli)! - First release of `create-rush-cms`: `npm create rush-cms@latest my-site` (also `bun create rush-cms my-site` and
  `pnpm create rush-cms my-site`) copies a production-ready Astro site wired to `@rushcms/astro` and `@rushcms/client`
  into `my-site`, for you to own.
  
  - The bundled template pins `@rushcms/client` and `@rushcms/astro` to the versions released with this package
    (`4.0.0` and `0.2.0`).
  - Sets `package.json` `name` from the folder name, renames `_gitignore` to `.gitignore` and creates `.env` from
    `.env.example` (empty values).
  - Installs dependencies with the package manager that ran it (npm, pnpm, bun or yarn; npm when unknown) unless
    `--no-install` is given; an install failure keeps the files and prints the command to run by hand.
  - An existing non-empty target stops with exit code 1 and nothing is written. Missing `<dir>` prints the usage and
    exits 1; `--help` prints it and exits 0.
  - No prompts, no network besides the install, no secrets and no `git init`. Requires Node 24 or later.
