# Rush CMS site

An [Astro](https://astro.build) site wired to [Rush CMS](https://github.com/rush-cms/rush-cms) through
[`@rushcms/astro`](https://github.com/rush-cms/js/tree/main/packages/astro) and
[`@rushcms/client`](https://github.com/rush-cms/js/tree/main/packages/client). It works with any Rush CMS site: every
collection, entry, locale, navigation and form comes from the CMS, and the URLs come from this repository. The code
is yours now; change anything.

Requires Node 24 or later.

## First run

1. Fill `.env`:

    | Variable         | Value                                                       |
    | ---------------- | ----------------------------------------------------------- |
    | `RUSH_API_URL`   | The Rush CMS API base URL                                   |
    | `RUSH_SITE_ID`   | The site ULID                                               |
    | `RUSH_API_TOKEN` | A delivery token of the site (secret: never commit it)      |
    | `RUSH_MEDIA_URL` | The media host, when it differs from the API (optional)     |
    | `RUSH_PREVIEW`   | `true` only for a [preview deployment](#preview-deployment) |

2. Run `npm run dev`. The first start stops with an error that lists the site's locales and a line to paste:

    ```text
    @rushcms/astro: localePaths locales [] differ from the site locales [pt_BR, en]. Set in astro.config:
      localePaths: { pt_BR: '', en: 'en' }
    ```

    When an AI coding agent starts the dev server, Astro runs it in the background and writes this error to
    `.astro/dev.log` instead of the terminal.

3. Paste that line over `localePaths: {}` in `astro.config.ts` and run `npm run dev` again. The default locale has
   no URL prefix; every other locale gets its own. Change the prefixes now if you like: they are part of your URLs.

4. Open <http://localhost:4321>, then work through the `TODO` comments (your editor's TODO list finds them all).

| Command           | What it does                                                          |
| ----------------- | --------------------------------------------------------------------- |
| `npm run dev`     | Development server with live content                                  |
| `npm run build`   | Production build in `dist/`                                           |
| `npm run preview` | Runs the built server with the variables of `.env`, when there is one |
| `npm run check`   | Type-checks the project with `astro check`                            |

## Routes and views

URLs come only from `routes` and `localePaths` in `astro.config.ts`. The template ships one generic route,
`'*': '/{locale}/{collection}/{slug}'`, which gives every collection a list page (`/en/posts`, `/en/posts/page/2`)
and entry pages (`/en/posts/hello`). Replace `'*'` with one key per public collection (a collection id or slug) so
that collections holding only data get no pages. A collection without a route has no pages, no sitemap entries and
no navigation links. See [Routes](https://github.com/rush-cms/js/tree/main/packages/astro#routes) for the rules.

No page file encodes a URL shape:

| File                                  | Answers                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `src/pages/[...path].astro`           | Every homepage, list page, taxonomy listing and entry, prerendered at build time |
| `src/pages/404.astro`                 | Every other path, on demand: redirects retired slugs, else the not-found page    |
| `src/pages/[...locale]/contact.astro` | The contact form of each locale, on demand                                       |
| `src/pages/sitemap.xml.ts`            | The sitemap, from the same routes                                                |
| `src/pages/robots.txt.ts`             | `robots.txt` (everything disallowed in a preview deployment)                     |

The dispatcher hands each page to a view:

- `src/views/home.astro`: the front page of every locale. It is a static welcome page; replace it with your design,
  or render the homepage built in Rush CMS from `page.homepage`.
- `src/views/collection.astro`: a collection list page with pagination.
- `src/views/taxonomy.astro`: the entries of a category or tag, with pagination (see [Taxonomies](#taxonomies)).
- `src/views/entry.astro`: an entry with its title, featured image, excerpt and every rich-text field.
- `src/views/not-found.astro`: the 404 page.

To give a collection its own design, create a view and map the collection id or slug in `src/views/index.ts`:

```ts
import PostEntry from './post-entry.astro'

const views: ViewMap = { posts: { entry: PostEntry } }
```

A view receives the same props as the generic one (`EntryViewProps` or `ListViewProps`), and `npm run check` fails
when it does not. `src/astro-modules.d.ts` lets plain TypeScript read the `.astro` imports of that file.

## Taxonomies

Categories and tags have no pages until `taxonomies` in `astro.config.ts` gives their type a path segment in every
locale of `localePaths`:

```ts
taxonomies: {
	category: { en: 'category', pt_BR: 'categoria' },
	tag: { en: 'tag', pt_BR: 'tag' }
}
```

Each category or tag with entries then gets a listing page per locale (`/category/design`, `/pt/categoria/design`,
`/category/design/page/2`), rendered by `src/views/taxonomy.astro` (`TaxonomyViewProps`) and listed in the sitemap.
Link to one with `getUrls(Astro).taxonomy(tag, locale)`, for instance from an entry's `categories`. See
[Taxonomies](https://github.com/rush-cms/js/tree/main/packages/astro#taxonomies) for the rules.

## Navigation and forms

Site content is fetched by stable keys that you create in Rush CMS:

| Key       | Kind       | Used by                                                |
| --------- | ---------- | ------------------------------------------------------ |
| `main`    | Navigation | The header menu (nested items open on hover and focus) |
| `footer`  | Navigation | The footer menu                                        |
| `contact` | Form       | `/contact` (and `/<locale>/contact`)                   |

Missing content renders nothing: no menu without the navigation, and `/contact` answers 404 without the form (in
`npm run dev` it shows a reminder instead). Change a key where the `TODO` points to it.

## Preview deployment

Deploy the same repository a second time with `RUSH_PREVIEW=true` and point the CMS preview URL templates at it:

```text
https://preview.example.com/_rush/preview?token={token}&locale={locale}&collection={collection}&slug={slug}
https://preview.example.com/_rush/preview?token={token}&locale={locale}
```

Every page of that deployment is rendered on demand with drafts, carries `X-Robots-Tag: noindex`, and shows a banner
with a link to leave the preview. See
[Preview deployment](https://github.com/rush-cms/js/tree/main/packages/astro#preview-deployment).

## Deployment

- `npm run build` fetches every page from the API and writes `dist/`. Static pages change only when you build again,
  so rebuild after publishing content.
- Run the server with `node ./dist/server/entry.mjs` (`HOST` and `PORT` set where it listens). It reads the `RUSH_`
  variables from the process environment, not from `.env`: set them on your host. `npm run preview` starts it
  locally with `.env` loaded (`node --env-file-if-exists=.env ./dist/server/entry.mjs`). The server answers the 404
  page, redirects, the contact page and form posts (`/_rush/forms/<key>`).
- Set `site` to your production URL: canonical links, `hreflang` links and the sitemap use it.
- List your domains in `security.allowedDomains`, or form posts and preview links fail on them.
- Set `trustedProxies` to the number of reverse proxies in front of the server, so form posts are rate-limited per
  visitor. The [topology table](https://github.com/rush-cms/js/tree/main/packages/astro#behind-reverse-proxies) gives
  the value for Coolify, nginx and Cloudflare.

## Styling

[Tailwind CSS 4](https://tailwindcss.com) through `@tailwindcss/vite`. The design tokens (colors and fonts) live in
`@theme` in `src/styles/global.css`, with their dark values under `prefers-color-scheme: dark`, so changing a token
restyles both themes. Rich text is styled by `@tailwindcss/typography` (`prose`), mapped to the same tokens. The UI
texts of the views are in English; translate them where they appear.
