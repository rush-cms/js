# Rush CMS JavaScript SDK

Monorepo for the JavaScript tooling around [Rush CMS](https://github.com/rush-cms/rush-cms): a typed client for the
public API, an Astro integration and the project starter.

## Packages

| Package                                       | Description                                  |
| --------------------------------------------- | -------------------------------------------- |
| [`@rushcms/client`](packages/client)          | Framework-agnostic client for the public API |
| [`@rushcms/astro`](packages/astro)            | Astro integration                            |
| [`create-rush-cms`](packages/create-rush-cms) | Project starter (placeholder)                |

## Development

Requires Node 24 and Bun 1.4.

```bash
bun install
bun run ci
```

`bun run ci` runs the format check, lint (oxlint with type-aware rules through oxlint-tsgolint), typecheck, tests, build (tsdown), the pack check and the types drift check.

Everything that ships is linted, typechecked and built with TypeScript 7. Two devDependencies still alias `typescript` to `@typescript/typescript6`: `scripts/package.json`, because `openapi-typescript` needs the TypeScript JavaScript API that TypeScript 7 only gets in 7.1, and `packages/astro`, because `astro check` refuses TypeScript 7. Remove each alias once TypeScript 7.1 ships that API and `openapi-typescript` supports it, and once `astro check` supports TypeScript 7 (or moves to `@astrojs/ts-content-mapper`).

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
each package (`@rushcms/client`, `@rushcms/astro`) pointing to the `release.yml` workflow of this repository. Until
then, the workflow only opens or updates the version pull request.

No push publishes anything without a changeset. `@rushcms/client` is versioned at `2.1.0`, the last published release, so
its first changeset (a major) bumps it to `3.0.0`. `@rushcms/astro` is versioned at `0.0.0`, which the owner publishes by
hand before enabling trusted publishing; its first changeset bumps it to `0.1.0`.

## License

MIT
