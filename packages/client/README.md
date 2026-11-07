# @rushcms/client

Typed client for the [Rush CMS](https://github.com/rush-cms/rush-cms) public API: every read of a site's content,
form submission, typed errors and URL helpers for multilingual sites. Framework-agnostic, ESM only, no runtime
dependencies. For Astro sites, [`@rushcms/astro`](https://github.com/rush-cms/js/tree/main/packages/astro) builds on
it.

Requires Node 24 or later and a Rush CMS v2 API serving the public API contract 1.0.0 (`/api/v1/{site_id}/…`, pinned
as [`openapi/public.json`](https://github.com/rush-cms/js/blob/main/openapi/public.json)). Versions 2.x talk to the
Rush CMS v1 (Laravel) API and share nothing with 3.x or later.

```bash
npm install @rushcms/client
```

## Client

```ts
import { createClient } from '@rushcms/client'

const token = process.env.RUSH_API_TOKEN
if (token === undefined) {
	throw new Error('RUSH_API_TOKEN is not set')
}

const rush = createClient({
	url: 'https://cms.example.com',
	siteId: '01JC3E28JT97KB6CQ643DZVMXX',
	token,
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

`createUrls({ routes, localePaths, collections, pageSegments })` builds site paths from API objects without any
request.

- `localePaths` maps every CMS locale code to its URL prefix; at most one prefix is `''` (no prefix).
- `routes` maps a collection id, any locale's collection slug or `'*'` to a pattern with `{locale}`, `{collection}`
  and `{slug}` (the last segment). There is no implicit route: a collection with no matching key has no URL. `'*'`
  matches every collection no other key matches (a specific key wins), so
  `routes: { '*': '/{locale}/{collection}/{slug}' }` gives every collection the generic shape.
- Every pattern contains `{locale}` (it collapses for the `''` prefix); the `'*'` pattern contains `{collection}`.
- `collections` (`RushCollections`, built by `listCollectionsByLocale(client, locales)`) lists the collections of
  every locale, so a route keyed by one locale's slug applies in every locale. With it, `createUrls` also rejects a
  route key that matches no collection, a collection slug equal to a locale prefix next to `{locale}/{collection}`
  and two routes that produce the same URLs; `match` needs it.
- `pageSegments` maps a CMS locale code to the segment of list pages after the first (default `page`).

Misconfigurations throw when `createUrls` runs (`route "<key>" must contain {locale}`,
`route "<key>" matches no collection`, `routes "<a>" and "<b>" produce the same URLs`, …).

| Helper                                                 | Returns                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `routed(collection)`                                   | Whether a `routes` key matches the collection                                   |
| `entry(entry)` / `translation(entry, locale)`          | The path of the entry in its own locale / in a translation's locale             |
| `servedPath(entry, requestedLocale)`                   | The path that answers for an entry as fetched for a locale, fallbacks included  |
| `moved(params)`                                        | The redirect target of a `moved` error, from its params alone                   |
| `collection(collection, locale, page?)`                | The list path of a collection (page 1 when omitted, else `<index>/<segment>/n`) |
| `match(pathname)`                                      | The entry, collection page or homepage a path names (`undefined` when none)     |
| `homepage(locale)` / `navigationItem(item, locale)`    | The homepage path / a navigation item's target (`undefined` without one)        |
| `localeOf(param)` / `localeParam(locale)`              | The locale of a URL prefix (exact match) / the prefix of a locale               |
| `entryParams(collection, locale, slug)`                | The route params of an entry path                                               |
| `collectionRef(key, locale)` / `collectionKeys(entry)` | A collection in a locale by any key / every key that names a collection         |
| `hasCollectionSegment(collection)`                     | Whether the collection's pattern has a `{collection}` segment                   |

`entry`, `translation`, `servedPath`, `collection` and `moved` throw `collection "<slug>" has no route` for a
collection without a route; check with `routed`. `servedPath` throws for an entry that was not fetched for that
locale, `translation` for a locale the entry has no translation in, and `collection` for a page that is not a positive
integer.

`match(pathname)` is the inverse of the builders for the same configuration: it returns
`{ kind: 'entry', locale, collection, slug }`, `{ kind: 'collection', locale, collection, page }`,
`{ kind: 'homepage', locale }` or `undefined`. It decodes each segment once, ignores a trailing or repeated slash and
gives `undefined` for upper-case or code-form locale segments (`/EN/blog`, `/pt_BR/blog`).

`alternates(entry | homepage, urls)` returns `{ locale, hreflang, url }` for every translation, in `localePaths`
order, built from `translatedLocales(entry | homepage)` (the locales it has a translation in) and
`translatedUrl(entry | homepage, locale, urls)` (its path in one of them), both exported for language switchers that
need more than the alternates. `toBcp47(code)` turns `pt_BR` into `pt-BR`.

The [`@rushcms/astro` README](https://github.com/rush-cms/js/tree/main/packages/astro#routes) shows these helpers in
routes, entry pages, redirects and sitemaps.

## Navigation and content helpers

- `navigationLinks(items, urls, locale)` turns the items of a navigation into `NavigationLink[]`: `label`, `href`,
  `target`, `rel` (the deduplicated union of `nofollow`, `noreferrer`, `noopener` for `_blank` and the tokens of the
  item's `rel` attribute), `className`, the other attributes as strings and `children`. An item whose target has no
  route keeps no `href` and stays only when it has children.
- `optional(promise)` resolves `undefined` when the request fails with `not_found` and rethrows anything else, for
  content a site may not have yet (a navigation, the homepage, a form).
- `isRichText(value)` tells whether a value is a TipTap document (`RichText`), for rendering entry data generically.

`@rushcms/client/internal` is an undocumented subpath for the other Rush packages and may change in any release.

## License

MIT
