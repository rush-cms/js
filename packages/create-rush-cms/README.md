# create-rush-cms

Creates a website powered by [Rush CMS](https://github.com/rush-cms/rush-cms): a production-ready
[Astro](https://astro.build) site wired to [`@rushcms/astro`](https://github.com/rush-cms/js/tree/main/packages/astro)
and [`@rushcms/client`](https://github.com/rush-cms/js/tree/main/packages/client). It works with any Rush CMS site
on day one, whatever its collections, locales and blocks. The generated code is yours: `create-rush-cms` never touches
it again.

Requires Node 24 or later.

## Usage

```bash
npm create rush-cms@latest my-site
bun create rush-cms my-site
pnpm create rush-cms my-site
```

| Argument or flag | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `<dir>`          | Required. The folder to create; it must not exist or be empty |
| `--no-install`   | Skip installing dependencies                                  |
| `-h`, `--help`   | Print the usage and exit                                      |

A missing `<dir>`, an unknown flag or an extra argument prints the usage and exits with code 1. An existing folder
that is not empty exits with code 1 and nothing is written.

## What it writes

- A copy of the [model site](https://github.com/rush-cms/js/tree/main/templates/astro) with `@rushcms/client` and
  `@rushcms/astro` pinned to the exact versions released together with this package.
- `package.json` `name`, taken from the folder name (made npm-valid).
- `.gitignore` (stored as `_gitignore` in the package, because npm strips `.gitignore` from tarballs).
- `.env`, a copy of `.env.example` with empty values.
- `node_modules`, installed with the package manager that ran the command (npm, pnpm, bun or yarn; npm when it cannot
  tell) unless `--no-install` is given. When the install fails, the files stay and the command to run by hand is
  printed, with exit code 1.

## What it never does

- Ask questions: there are no prompts.
- Use the network, apart from the dependency install.
- Read, ask for or write secrets: `.env` is left empty for you to fill.
- Run `git init`, commit or touch an existing repository.
- Edit anything after the first run.

## Next steps

1. `cd my-site`, and install if you used `--no-install`.
2. Fill `.env` with the API URL, the site id and a delivery token of your Rush CMS site. Set `SITE_URL` to your
   production URL when you build: `site` and `security.allowedDomains` come from it, and it falls back to
   `http://localhost:4321` in development.
3. Run `npm run dev` (or `bun run dev`, `pnpm run dev`). The first start stops with an error that lists the site's
   locales and a `localePaths` line; paste it into `astro.config.ts` and run it again.
4. Search the project for `TODO` markers: each one is a place to customize (routes, navigation, the production
   domain in `SITE_URL`, `trustedProxies`).

The [template README](https://github.com/rush-cms/js/blob/main/templates/astro/README.md) covers the routes, views,
preview deployment and deployment topologies.

## License

MIT
