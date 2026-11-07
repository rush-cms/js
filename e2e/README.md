# End-to-end fixtures

`astro-site/` is a small multilingual Astro site built on the published shape of `@rushcms/client` and
`@rushcms/astro`, plus a scripted browser walk-through that runs it against a real Rush CMS API seeded with the
`sdk-e2e` preset. `template/` generates sites with the packed `create-rush-cms` and walks them against the same API
(see [Template site walk](#template-site-walk)). `walk-kit/` holds the walk modules both fixtures share (browser,
proxy, admin API, contact form, preview session, results); it is a plain directory with its own `package.json`
(`puppeteer-core`, and `@rushcms/client` copied from `packages/client` for its type guards), installed with
`bun install --force` in `e2e/walk-kit` after the client is built.

## Decisions

- The fixture is not a workspace member. It installs the packages from tarballs packed from their `dist` (the same
  files npm would ship), never from workspace sources, so `bun run ci` at the root never needs it, a running API or
  a browser. The root lint skips `e2e/**`; the fixture lints itself with the same rules (`bun run check`).
- Its dependencies are pinned exactly and it keeps no lockfile: the tarballs are rebuilt on every run, so a lockfile
  would only record their changing hashes.
- `bun run check` runs `astro check`, `tsc` and oxlint over the fixture, then type-checks the packed `.d.ts` files of
  both packages with `skipLibCheck` off (errors from other packages are not reported), because tsdown generates them
  with the tsgo generator that is experimental until TypeScript 7.1.
- Every locale has a URL prefix (`pt_BR` → `/pt`, `en` → `/en`, `es` → `/es`); `/` redirects to `/pt`.
- Entry pages follow the `@rushcms/astro` README pattern: `resolveEntry(Astro)` takes the `getStaticPaths` props when
  prerendered and fetches by route params on demand (the preview deployment, where every route is on demand). An
  on-demand catch-all route calls `resolveEntry` with the path segments and turns `moved` into a redirect for URLs
  that were not prerendered: `301`, or `302` on the preview instance (`permanent` is `false` there). A `found` entry
  reached through a route key (`/en/servicos/web-development`) redirects to `urls.servedPath(entry, locale)`, and
  answers `404` only when that is the requested path. Locale segments map back through `localeOf`; the integration
  middleware answers `404` for a `locale` param that is no prefix, so pages read their locale with `pageLocale`.
- `routes` is explicit: `'*': '/{locale}/{collection}/{slug}'` serves every collection without its own route, and the
  services collection has a fixed route, `servicos: '/{locale}/solutions/{slug}'`, keyed by its `pt_BR` slug: `src/pages/[locale]/solutions/` serves it in every locale (`resolveEntry(Astro, { collection:
'servicos' })` maps the key to `services`/`servicios`), the catch-all maps the `solutions` segment to the key, and
  the `[collection]` pages skip collections whose pattern has no `{collection}`.
- A route key that matches no collection fails the build, so the captcha site (which has no services collection)
  builds with `RUSH_CAPTCHA_SITE=true` (set by `build:captcha`), which drops the fixed route in `src/site-config.ts`.
- The pages are file-per-shape (`[locale]/index`, `[locale]/[collection]/…`, `[locale]/solutions/…`) because every
  locale has a prefix, the setup `@rushcms/astro` supports besides the dispatcher route. Its preview build still
  prints `getStaticPaths() ignored in dynamic page` for those files: expected here, the dispatcher route of the
  template site is what builds without it.
- Content that may not exist (navigation, homepage, collections) is read through `optional` from `@rushcms/client`;
  the main navigation comes from `getNavigation(Astro, 'main')` and renders each `NavigationLink` with its `href`,
  `target`, `rel`, `className` and `attributes`. Type guards come from `@rushcms/client/internal`.
- `trustedProxies` is required, so `astro.config.ts` sets it per build: `1` for the site and captcha builds, because
  the walker reaches the forms route of the site through its proxy, and `0` for the preview build, which is only
  reached directly. `src/site-config.ts` holds only the URL options (`UrlConfig`) shared with the pages.
- Links use `getUrls(Astro)` (`urls.servedPath` for list items, fallback pages included); `getStaticPaths` builds the
  same helpers with `createUrls({ ...siteConfig, collections })`.
- The seeded `body` rich text renders through `<RichText>` with a `callout` block component, the featured image
  through `<RushImage>`. The API runs the media worker in process, so dimensions are set once `make dev/up` has
  started; before that `RushImage` renders a plain `<img>` without Astro's optimization.

## API side, from zero

In a `rush-cms` checkout (a worktree keeps its own `backend/.env`):

1. Point `backend/.env` at a database used only by this fixture (for example `rush_cms_e2e`), with `PORT=8091`,
   `MEDIA_DRIVER=local` and `ADMIN_CORS_ORIGINS=http://localhost:5174`. Create that database for the role in
   `DATABASE_URL` in the devstack Postgres.
2. `make migrate/up`, then `make db/seed SEED_FLAGS="--preset=sdk-e2e"`. The seed prints the site ids, delivery
   tokens and admin login used below. To start over:
   `make db/fresh-seed FRESH_FLAGS=--yes SEED_FLAGS="--preset=sdk-e2e"`.
3. `make dev/up > <log file>` (API on `:8091`; `make dev/down` stops it). The walker reads the API request log from
   that file (`API_LOG`) to count entry requests.
4. Admin, for the preview check: `cd frontend && bun install && VITE_API_URL=http://localhost:8091 bun run dev`
   (`:5174`).

The admin API requires the `rush_refresh` and `rush_csrf` cookies (and the `X-CSRF-Token` header) on
`/auth/switch-site`, so the walker keeps the cookies of its login and sends them on every admin call.

The seeded preview URL templates point at `http://localhost:4322/_rush/preview`.

## Fixture

From the repository root run `bun install` once, then in `e2e/astro-site`:

```bash
bun run sdk:pack
bun install --force
bun install --cwd ../walk-kit --force
```

`sdk:pack` builds both packages and packs them into `.packs/`; run both commands again after changing a package.

Create three env files from the seed output (all git-ignored):

```bash
# .env.site: the fixture site (captcha off)
RUSH_API_URL=http://localhost:8091
RUSH_SITE_ID=<sdk-e2e site id>
RUSH_API_TOKEN=<sdk-e2e delivery token>

# .env.captcha: the captcha site (Turnstile always-pass test keys)
RUSH_API_URL=http://localhost:8091
RUSH_SITE_ID=<sdk-e2e-captcha site id>
RUSH_API_TOKEN=<sdk-e2e-captcha delivery token>

# .env.walk: the walk-through
RUSH_API_URL=http://localhost:8091
RUSH_SITE_ID=<sdk-e2e site id>
RUSH_CAPTCHA_SITE_ID=<sdk-e2e-captcha site id>
ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<admin password>
RUSH_API_TOKEN=<sdk-e2e site API token>
CHROME_PATH=/usr/bin/google-chrome
E2E_SHOTS_DIR=<directory for screenshots and results>
API_LOG=<the make dev/up log file>
```

Check and build the three outputs:

```bash
bun run check
bun run build
bun run build:preview
bun run build:captcha
```

| Instance | Build           | Start                   | Port   |
| -------- | --------------- | ----------------------- | ------ |
| Site     | `build`         | `start`                 | `4321` |
| Preview  | `build:preview` | `start:preview`         | `4322` |
| Captcha  | `build:captcha` | `start:captcha`         | `4323` |
| Proxy    | none            | started by the walker   | `4400` |
| Admin    | none            | see the API side, above | `5174` |

## Walk-through

The walker drives Chrome (`puppeteer-core`, no browser download) and prints one line per check (`PASS`, `FAIL` or
`BLOCKED` with its evidence); screenshots and `results-<groups>.json` go to `E2E_SHOTS_DIR`. Run it in two phases so
that only two Astro servers run at a time:

```bash
bun run start & bun run start:preview &
bun run walk site preview
# stop the preview server, then
bun run start:captcha &
bun run walk captcha
```

- `site`: language switcher and hreflang; fallback page and canonical; `301` from a retired slug, from another
  locale's slug and from a wrong collection segment; services order (on the fixed route) and tag page; the fixed
  route in `pt`, `en` and `es` (`200` at the canonical URL, one `301` hop from another locale's slug, and from the
  route key segment through the catch-all); form with and without JavaScript
  (`303`); visitor IP behind a forwarding proxy (the browser's own `X-Forwarded-For` is ignored); `429` after the
  visitor limit; rich text (heading, link, list, image,
  callout block) in each locale; featured image through `RushImage`, and its media URL answers `200`.
- `preview`: an entry page on the preview instance without a cookie (on demand, no props); the fixed route on demand
  in `en` (`200`, and one `302` hop from the `pt` and `es` slugs and from the route key segment); `/pt_BR/` and
  `/PT/` answer `404`; a `moved` redirect on both instances (`301` on the
  site, `302` on the preview instance) with the API's entry requests counted between two sentinel requests in `API_LOG` (the redirect
  costs only the `moved` answer, no lookup of its target); a forged, rotating `X-Forwarded-For` from a direct client
  on the preview instance (a temporary form created and deleted through the admin API, so its limit window is new:
  exactly 5 posts accepted, the 6th `429`, every stored IP the Astro server's loopback address); saves a draft excerpt in the admin, follows the admin
  Preview button to `:4322`, exits the preview and restores the excerpt.
- `captcha`: Turnstile pass; Turnstile fail after flipping the site secret to the always-fail key through the admin
  API (restored afterwards).

Notes:

- The proxy check maps `visitor.test` to the machine's first non-loopback IPv4 address in Chrome, so the proxy sees
  that address and appends it to the `X-Forwarded-For` the browser sent (a forged one) while Node only sees the proxy
  on loopback; `astro.config.ts` lists `visitor.test` in `security.allowedDomains`. Without such an interface the
  check is `BLOCKED`.
- The Turnstile checks need the browser and the API to reach `challenges.cloudflare.com`; without it they are
  `BLOCKED`.
- The visitor limit is 5 posts per minute. The `429` check forwards a fresh random visitor IP through the proxy on
  every run, so its window is new by construction: exactly 5 posts are accepted, the 6th is `429` with
  `params.retry_after` in the page message, and a direct API post for the same visitor (`RUSH_API_TOKEN`) returns the
  `Retry-After` header.
- `bun run check` calls `node_modules/typescript7/bin/tsc` explicitly: both `typescript` (6, for `astro check`) and
  `typescript7` install a `tsc` binary and `.bin/tsc` points at whichever was linked last.
- Ports live in `walk/env.ts` (`PORTS`, from the site and preview ports of `walk-kit/env.ts`); `scripts/serve.ts`
  starts each instance from them.

## Template site walk

`template/` proves that a site generated by `create-rush-cms` works against the local API. Like `astro-site/` it is
not a workspace member, keeps no lockfile and lints itself (`bun run check`, which also checks `walk-kit/`). It needs
the API side above, the root `bun install`, `bun install` in `e2e/template` and a git-ignored `.env.walk`:

```bash
RUSH_API_URL=http://localhost:8091
RUSH_SITE_ID=<sdk-e2e site id>
RUSH_API_TOKEN=<sdk-e2e delivery token>
ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<admin password>
CHROME_PATH=/usr/bin/google-chrome
E2E_SHOTS_DIR=<directory for screenshots and results>
E2E_WORK_DIR=<empty directory for the generated sites>
```

```bash
bun run generate
bun run walk a b
```

- `generate` runs `bun run build` at the root, packs `@rushcms/client`, `@rushcms/astro` and `create-rush-cms` into
  `.packs/`, and runs the packed `create-rush-cms` twice in `E2E_WORK_DIR`: through `npm exec` (`npm-site`) and
  through `bun x` (`bun-site`). The generated `package.json` pins the SDK at the workspace versions, which may
  already exist on npm with other contents, so `scripts/registry.ts` serves the two SDK tarballs at those versions
  on `127.0.0.1:4873` and forwards every other package to the npm registry; the creator's own install reaches it
  through `npm_config_registry`/`BUN_CONFIG_REGISTRY`, with npm and bun caches inside `E2E_WORK_DIR`. Each run must
  name its package manager in the next steps, leave only that manager's lockfile, and install SDK `dist` files
  byte-equal to the build.
- `walk a` uses `npm-site` with the `sdk-e2e` site; `walk b` uses `bun-site` with a fresh site created through the
  admin API (one locale, no homepage, navigation or form, one collection with no entries), deleted afterwards. For
  each, the walker fills `.env`, runs `dev` until the first-run error, checks its text, pastes the suggested
  `localePaths` line (site `a`: `pt_BR` at `''`), sets `allowedDomains` to `localhost` and the proxy host, then
  builds twice (`build`, and `RUSH_PREVIEW=true` into `dist-preview`, which must print no
  `getStaticPaths() ignored` line), serves the site with the project's `preview` script on `4321` and the preview
  build on `4322`, and walks: front page per locale, collection lists and pagination, entries per locale (hreflang,
  canonical, rich text, featured image), header/footer navigation and language switcher (every internal link answers
  `200`), contact form with and without JavaScript through the proxy (`trustedProxies: 1` as shipped), `404` for
  upper-case and code-form locale segments, retired slugs (`301` on the site, `302` on the preview deployment),
  `sitemap.xml` (every `<loc>` answers `200`) and `robots.txt`, the preview deployment on demand, a draft entry
  created through the admin API and opened through its preview link (cookie, banner, draft, exit), and the delivery
  token absent from both client bundles. Last, `dev` serves `/`, `/en` and `/contact` (site `a`: the form) or `/`
  and `/contact` (site `b`: the dev-only notice, while the build answers `404` there).
- Site `a` gets a `footer` navigation (an external link with `nofollow`, `noreferrer`, `_blank`, a `rel` attribute
  and a `data-` attribute) and a blog page size of 2 for the walk; both are restored afterwards.
- Every server is started in its own process group and stopped by its PID.
- The processes started in a generated project drop the walker's own `RUSH_*` variables, which would override its
  `.env`, and the AI-agent markers `AGENT`, `AI_AGENT` and `CLAUDECODE`: Astro 7.4 starts `astro dev` as a background
  server with JSON logs when it detects an agent, and only `Dev server process exited before becoming ready.`
  reaches the terminal instead of the `localePaths` error (it lands in `.astro/dev.log`).
