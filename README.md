# Rush CMS JavaScript SDK

Monorepo for the JavaScript tooling around [Rush CMS](https://github.com/rush-cms/rush-cms): a typed client for the
public API, an Astro integration, a model Astro site and the project starter that generates it.

## Packages

| Package                                       | Description                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| [`@rushcms/client`](packages/client)          | Framework-agnostic client for the public API                             |
| [`@rushcms/astro`](packages/astro)            | Astro integration                                                        |
| [`create-rush-cms`](packages/create-rush-cms) | Project starter: `npm create rush-cms@latest my-site`                    |
| [`templates/astro`](templates/astro)          | The model site `create-rush-cms` bundles (private workspace, not on npm) |
| [`e2e`](e2e)                                  | End-to-end fixtures and browser walks against a real API (not in CI)     |

## Development

Requires Node 24 and Bun 1.4.

```bash
bun install
bun run ci
```

`bun run ci` runs the format check, lint (oxlint with type-aware rules through oxlint-tsgolint), typecheck, tests, build (tsdown), the pack check and the types drift check.

Everything that ships is linted, typechecked and built with TypeScript 7. Three devDependencies still alias `typescript` to `@typescript/typescript6`; remove each alias when its reason is gone:

- `scripts/package.json`: `openapi-typescript` needs the TypeScript JavaScript API, which TypeScript 7 only gets in 7.1, and must also support it.
- `packages/astro`: `astro check` refuses TypeScript 7.
- `templates/astro`: the same `astro check` limit, for the site `create-rush-cms` generates; the alias ships in the generated `package.json`.

Remove the astro aliases once `astro check` supports TypeScript 7 (or moves to `@astrojs/ts-content-mapper`).

tsdown builds the declaration files with its tsgo generator, which it flags as deprecated on TypeScript 7.0; the warning disappears with TypeScript 7.1.

| Command                            | What it does                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `bun run api:sync [--from <path>]` | Copies the API contract into `openapi/public.json` (default `../rush-cms-v2/backend/api/public.yaml`) |
| `bun run api:types`                | Generates `packages/client/src/generated/api.ts` from the contract                                    |
| `bun run types:drift`              | Regenerates the types and fails if the committed file differs                                         |
| `bun run changeset`                | Records a release note for a change                                                                   |

`openapi/public.json` is a pinned copy of the contract. After the API changes, run `api:sync` and `api:types` and
commit both results.

## Releasing

Releases use [changesets](https://github.com/changesets/changesets) and npm trusted publishing (OIDC with
provenance, no npm token). The release workflow stays inert until the owner configures trusted publishing on npm for
each published package (`@rushcms/client`, `@rushcms/astro` and `create-rush-cms`) pointing to the `release.yml`
workflow of this repository. `create-rush-cms` needs its trusted publisher before its first real publish (0.1.0).
Until then, the workflow only opens or updates the version pull request.

The workflow acts as the `rush-cms-release` GitHub App (contents and pull requests write, installed on this repository
only), so the version pull request and its commits trigger CI. It needs the repository secret `RELEASE_APP_PRIVATE_KEY`;
the app's client id is public and lives in `release.yml`.

No push publishes anything without a changeset. `templates/astro` is private and never versioned or published. A
changeset that releases `@rushcms/client` or `@rushcms/astro` must also release `create-rush-cms`
(`bun run changesets:check` enforces it in CI), because the starter bundles the template with both packages pinned to the exact
versions being released.

## License

MIT
