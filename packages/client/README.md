# @rushcms/client

Typed client for the [Rush CMS](https://github.com/rush-cms/rush-cms) public API: every read of a site's content,
form submission, typed errors and URL helpers for multilingual sites. Framework-agnostic, ESM only, no runtime
dependencies. For Astro sites, [`@rushcms/astro`](https://github.com/rush-cms/js/tree/main/packages/astro) builds on
it.

Requires Node 24 or later and a Rush CMS v2 API serving the public API contract 1.0.0 (`/api/v1/{site_id}/…`, pinned
as [`openapi/public.json`](https://github.com/rush-cms/js/blob/main/openapi/public.json)). Versions 2.x talk to the
Rush CMS v1 (Laravel) API and share nothing with 3.x.

```bash
npm install @rushcms/client
```

## Client

```ts
import { createClient } from '@rushcms/client'

const rush = createClient({
	url: 'https://cms.example.com',
	siteId: '01JC3E28JT97KB6CQ643DZVMXX',
	token: process.env.RUSH_API_TOKEN,
	locale: 'pt_BR'
})

const entry = await rush.entries.get('artigos', 'ola-mundo')
```

| Option        | Description                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `url`         | API base URL (a trailing `/` is ignored)                                                                |
| `siteId`      | Site ULID                                                                                               |
| `token`       | API token of the site: a delivery token, a preview token or a `rush_prv_` preview link token            |
| `locale`      | Default `locale` of localized requests; without it the API negotiates (`Accept-Language`, site default) |
| `perspective` | Default `published` or `draft` (draft needs a preview token)                                            |
| `fetch`       | `(url, init) => Promise<Response>` used instead of the global `fetch`                                   |
| `memo`        | Keep every GET result for the client's lifetime (default `false`)                                       |
| `etagStore`   | Store for conditional requests (see below)                                                              |
| `routes`      | URL patterns per collection, exposed as `client.routes` for the URL helpers                             |
| `localePaths` | CMS locale code → URL prefix, exposed as `client.localePaths` for the URL helpers                       |

The token is sent as `Authorization: Bearer <token>` on every request.

## Resources

| Resource      | Methods                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `site`        | `get()`                                                                                               |
| `collections` | `list()`, `get(collection)`                                                                           |
| `entries`     | `list(collection, options?)`, `get(collection, slug)`, `search(collection, query)`, `all(collection)` |
| `homepage`    | `get()`                                                                                               |
| `navigations` | `list()`, `get(key)`                                                                                  |
| `siteOptions` | `list()`, `get(key)`                                                                                  |
| `tags`        | `list()`, `entries(tag, options?)`                                                                    |
| `blocks`      | `list()`, `get(key)`                                                                                  |
| `databases`   | `list()`, `get(key)`                                                                                  |
| `linkPages`   | `list()`, `get(key)`                                                                                  |
| `forms`       | `list()`, `get(key)`, `submit(key, data, { clientIp?, captchaToken? })`                               |

- Every method takes the query options of its API operation as the last argument (`locale`, `perspective`, `page`,
  `per_page`, filters); a per-call `locale` or `perspective` overrides the client's.
- Responses are unwrapped from the API envelope: single resources return the object, paginated calls return
  `{ items, meta }`. API objects are returned as received and never mutated.
- `entries.all(collection, options?)` is an async iterator over every entry of the collection, 100 per request:

    ```ts
    for await (const entry of rush.entries.all('artigos')) {
    	console.log(entry.slug)
    }
    ```

- `forms.submit` is meant for the site's server. It sends a plain object as JSON and a `FormData` as multipart
  (files included). `clientIp` is sent as `X-Rush-Client-IP`, the visitor IP the API rate-limits and stores; pass
  only an address your server observed or one your own proxies appended, never one the visitor can choose.
  `captchaToken` is sent as `X-Captcha-Token`. Real and honeypot submissions both answer `{ received: true }`.

Types for every contract shape are exported under friendly names (`Entry`, `Site`, `Collection`, `Navigation`,
`SiteOptionGroup`, `Tag`, `Form`, `Media`, …), plus the generated `components`, `paths` and `operations`.

## Errors

Every failure is a `RushError` with `status`, `code`, `params` and `errors` (per-field `{ field, code, … }` for
validation). `code` is the API's stable error code, or `network_error` (the request or the body read failed;
`status` `0` when no response arrived) or `invalid_response` (a body that is not the expected envelope).
`isRushError(err, code)` narrows `params` for `moved`, `not_found`, `not_translated`, `locale_not_served` and
`rate_limited`:

```ts
import { createUrls, isRushError } from '@rushcms/client'

const urls = createUrls({ localePaths: { pt_BR: '', en: 'en' } })

async function pathOf(slug: string): Promise<string | undefined> {
	try {
		return urls.entry(await rush.entries.get('artigos', slug))
	} catch (err) {
		if (isRushError(err, 'moved')) {
			return urls.moved(err.params)
		}
		if (isRushError(err, 'not_found')) {
			return undefined
		}
		throw err
	}
}
```

## Request reuse

- Identical GETs in flight at the same time share one request.
- `memo: true` keeps every GET result for the lifetime of the client. Use it for one static build, never for a
  long-running server, where content changes.
- `etagStore` (`{ get(key), set(key, { etag, body }) }`, both async) enables conditional requests: a stored record
  is sent as `If-None-Match` and a `304` returns its body without a download. Draft responses carry no `ETag` and are
  never stored.

```ts
import type { EtagRecord, EtagStore } from '@rushcms/client'

const records = new Map<string, EtagRecord>()
const etagStore: EtagStore = {
	get: async (key) => records.get(key),
	set: async (key, record) => {
		records.set(key, record)
	}
}
```

## URLs

`createUrls({ routes, localePaths, collections })` builds site paths from API objects without any request.

- `localePaths` maps every CMS locale code to its URL prefix; at most one prefix is `''` (no prefix).
- `routes` maps a collection id or any locale's collection slug to a pattern with `{locale}`, `{collection}` and
  `{slug}` (the last segment). The default pattern is `/{locale}/{collection}/{slug}`.
- `collections` (`RushCollections`, built by `listCollectionsByLocale(client, locales)`) lists the collections of
  every locale, so a route keyed by one locale's slug applies in every locale.

| Helper                                                 | Returns                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `entry(entry)` / `translation(entry, locale)`          | The path of the entry in its own locale / in a translation's locale            |
| `servedPath(entry, requestedLocale)`                   | The path that answers for an entry as fetched for a locale, fallbacks included |
| `moved(params)`                                        | The redirect target of a `moved` error, from its params alone                  |
| `collection(collection, locale)`                       | The listing path of a collection                                               |
| `homepage(locale)` / `navigationItem(item, locale)`    | The homepage path / a navigation item's target (`undefined` without one)       |
| `localeOf(param)` / `localeParam(locale)`              | The locale of a URL prefix (exact match) / the prefix of a locale              |
| `entryParams(collection, locale, slug)`                | The route params of an entry path                                              |
| `collectionRef(key, locale)` / `collectionKeys(entry)` | A collection in a locale by any key / every key that names a collection        |
| `hasCollectionSegment(collection)`                     | Whether the collection's pattern has a `{collection}` segment                  |

`alternates(entry | homepage, urls)` returns `{ locale, hreflang, url }` for every translation, in `localePaths`
order, and `toBcp47(code)` turns `pt_BR` into `pt-BR`. `servedPath` throws for an entry that was not fetched for
that locale, `translation` for a locale the entry has no translation in.

The [`@rushcms/astro` README](https://github.com/rush-cms/js/tree/main/packages/astro#entry-pages) shows these helpers
in entry pages, redirects and sitemaps.

## License

MIT
