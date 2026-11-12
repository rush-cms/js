# create-rush-cms

## 0.3.5

### Patch Changes

- [`053ce0d`](https://github.com/rush-cms/js/commit/053ce0de894d3c4b61dbeda68b651441907ba84f) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Bundles the updated client and astro packages with the non-null homepage `meta` contract.

## 0.3.4

### Patch Changes

- [`d1eda93`](https://github.com/rush-cms/js/commit/d1eda93dc732be92cca405e0849495f15adc1850) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `--ssg` removes the empty `src/pages/[...locale]` directory that dropping the contact page leaves behind. The generic entry view no longer renders rich-text fields, which the template cannot know: it shows a note to edit `src/views/entry.astro`. The scaffold also pins the `@rushcms/client` and `@rushcms/astro` releases that fix `optional` and the untranslated homepage.

## 0.3.3

### Patch Changes

- [`5f65f02`](https://github.com/rush-cms/js/commit/5f65f021a2016f875bf7c297a78e95302fd7dc0e) Thanks [@rmarsigli](https://github.com/rmarsigli)! - The scaffold reads `SITE_URL` (default `http://localhost:4321`) to set `site` and `security.allowedDomains` in `astro.config.ts`; the two TODO comments are gone and `.env.example` lists `SITE_URL`.

## 0.3.2

### Patch Changes

- [`fbdfd43`](https://github.com/rush-cms/js/commit/fbdfd43999d77583a5de4a79feaeb6a21d344069) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `trustedProxies` is required only when the integration serves on-demand routes (forms enabled or a preview deployment) and is optional and ignored on a static site; the option only becomes optional, so existing configs keep working. `create-rush-cms --ssg` no longer writes it.

## 0.3.1

### Patch Changes

- [`6ce573c`](https://github.com/rush-cms/js/commit/6ce573c9790f6e138efe2bfccf81f4005cd4af0c) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Docs: a prefixed `404.astro` builds to `dist/<prefix>/404/index.html` with Astro's default build format, not `dist/<prefix>/404.html`; the nginx examples point there.

## 0.3.0

### Minor Changes

- [`39990e9`](https://github.com/rush-cms/js/commit/39990e9c5988517387ab886cc1c97fb1f4c8ba7f) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Add the `--ssg` flag: scaffolds a purely static site with no Node adapter, no contact page and no forms route, and one prerendered `404.astro`.

## 0.2.2

### Patch Changes

- [`4edd89b`](https://github.com/rush-cms/js/commit/4edd89b13eac94e2b767feb1c006fde8316d2e84) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Scaffolded list and taxonomy pages use `<Seo page>` with a site-name `titleSuffix`, list cards pass `sizes` and `aspectRatio` to `RushImage`, the entry cover loads with `priority`, and an empty list page is marked `noindex`, as the sitemap leaves it out.

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
