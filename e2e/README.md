# End-to-end fixture

`astro-site/` is a small multilingual Astro site built on the published shape of `@rushcms/client` and
`@rushcms/astro`, plus a scripted browser walk-through that runs it against a real Rush CMS API seeded with the
`sdk-e2e` preset.

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
- Pages are prerendered from `getStaticPaths` props and fall back to fetching by route params when the props are
  missing, which is the case in the preview deployment (every route on demand). An on-demand catch-all route turns
  the API's `moved` answers into `301`s for URLs that were not prerendered.

## API side, from zero

In a `rush-cms` checkout (a worktree keeps its own `backend/.env`):

1. Point `backend/.env` at a database used only by this fixture (for example `rush_cms_e2e`), with `PORT=8091`,
   `MEDIA_DRIVER=local` and `ADMIN_CORS_ORIGINS=http://localhost:5174`. Create that database for the role in
   `DATABASE_URL` in the devstack Postgres.
2. `make migrate/up`, then `make db/seed SEED_FLAGS="--preset=sdk-e2e"`. The seed prints the site ids, delivery
   tokens and admin login used below. To start over: `make db/fresh-seed FORCE=1 SEED_FLAGS="--preset=sdk-e2e"`.
3. `make dev/up` (API on `:8091`; `make dev/down` stops it).
4. Admin, for the preview check: `cd frontend && bun install && VITE_API_URL=http://localhost:8091 bun run dev`
   (`:5174`).

The seeded preview URL templates point at `http://localhost:4322/_rush/preview`.

## Fixture

From the repository root run `bun install` once, then in `e2e/astro-site`:

```bash
bun run sdk:pack
bun install --force
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
  locale's slug and from a wrong collection segment; services order and tag page; form with and without JavaScript
  (`303`); visitor IP behind a forwarding proxy; `429` after the visitor limit.
- `preview`: saves a draft excerpt in the admin, follows the admin Preview button to `:4322`, exits the preview and
  restores the excerpt.
- `captcha`: Turnstile pass; Turnstile fail after flipping the site secret to the always-fail key through the admin
  API (restored afterwards).

Notes:

- The proxy check maps `visitor.test` to the machine's first non-loopback IPv4 address in Chrome, so the proxy sees
  that address and forwards it as `X-Forwarded-For` while Node only sees the proxy on loopback; `astro.config.ts`
  lists `visitor.test` in `security.allowedDomains`. Without such an interface the check is `BLOCKED`.
- The Turnstile checks need the browser and the API to reach `challenges.cloudflare.com`; without it they are
  `BLOCKED`.
- The visitor limit is 5 posts per minute. The `429` check forwards a fresh random visitor IP through the proxy on
  every run, so its window is new by construction: exactly 5 posts are accepted, the 6th is `429` with
  `params.retry_after` in the page message, and a direct API post for the same visitor (`RUSH_API_TOKEN`) returns the
  `Retry-After` header.
- `bun run check` calls `node_modules/typescript7/bin/tsc` explicitly: both `typescript` (6, for `astro check`) and
  `typescript7` install a `tsc` binary and `.bin/tsc` points at whichever was linked last.
- Ports live in `walk/env.ts` (`PORTS`); `scripts/serve.ts` starts each instance from them.
