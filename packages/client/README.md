# @rushcms/client

Typed client for the [Rush CMS](https://github.com/rush-cms/rush-cms) public API: every read of a site's content,
form submission, typed errors and URL helpers for multilingual sites. Framework-agnostic, ESM only, no runtime
dependencies. For Astro sites, [`@rushcms/astro`](https://github.com/rush-cms/js/tree/main/packages/astro) builds on
it.

Requires Node 24 or later and a Rush CMS API serving the public API contract 1.0.0 (`/api/v1/{site_id}/…`, pinned
as [`openapi/public.json`](https://github.com/rush-cms/js/blob/main/openapi/public.json)).

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
`status` `0` when no response arrived) or `invalid_response` (a body that is not the expected envelope, or a response redirected to another origin: an
`http://` API URL that the server redirects to `https://` loses the `Authorization` header on the way, so the error
names both origins and tells you to set the API URL to the final one).
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

`createUrls({ routes, localePaths, collections, pageSegments, taxonomies })` builds site paths from API objects
without any request.

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
- `taxonomies` gives categories and tags their listing pages (see [Taxonomies](#taxonomies)).

Misconfigurations throw when `createUrls` runs (`route "<key>" must contain {locale}`,
`route "<key>" matches no collection`, `routes "<a>" and "<b>" produce the same URLs`, …).

| Helper                                                  | Returns                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `routed(collection)`                                    | Whether a `routes` key matches the collection                                                |
| `entry(entry)` / `translation(entry, locale)`           | The path of the entry in its own locale / in a translation's locale                          |
| `servedPath(entry, requestedLocale)`                    | The path that answers for an entry as fetched for a locale, fallbacks included               |
| `moved(params)`                                         | The redirect target of a `moved` error, from its params alone                                |
| `collection(collection, locale, page?)`                 | The list path of a collection (page 1 when omitted, else `<index>/<segment>/n`)              |
| `taxonomy(tag, locale, page?)`                          | The listing path of a category or tag (`undefined` when its type has no segment)             |
| `match(pathname)`                                       | The entry, collection page, taxonomy page or homepage a path names (`undefined` when none)   |
| `homepage(locale)` / `navigationItem(item, locale)`     | The homepage path / a navigation item's target (`undefined` without one)                     |
| `localeOf(param)` / `localeParam(locale)`               | The locale of a URL prefix (exact match) / the prefix of a locale                            |
| `entryParams(collection, locale, slug)`                 | The route params of an entry path                                                            |
| `collectionRef(key, locale)` / `collectionKeys(source)` | A collection in a locale by any key / every key that names the collection of an entry or ref |
| `hasCollectionSegment(collection)`                      | Whether the collection's pattern has a `{collection}` segment                                |

`entry`, `translation`, `servedPath`, `collection` and `moved` throw `collection "<slug>" has no route` for a
collection without a route; check with `routed`. `servedPath` throws for an entry that was not fetched for that
locale, `translation` for a locale the entry has no translation in, and `collection` for a page that is not a positive
integer.

`match(pathname)` is the inverse of the builders for the same configuration: it returns
`{ kind: 'entry', locale, collection, slug }`, `{ kind: 'collection', locale, collection, page }`,
`{ kind: 'taxonomy', locale, type, slug, page }`, `{ kind: 'homepage', locale }` or `undefined`. It decodes each segment once, ignores a trailing or repeated slash and
gives `undefined` for upper-case or code-form locale segments (`/EN/blog`, `/pt_BR/blog`).

`alternates(entry | homepage, urls)` returns `{ locale, hreflang, url }` for every translation, in `localePaths`
order, built from `translatedLocales(entry | homepage)` (the locales it has a translation in) and
`translatedUrl(entry | homepage, locale, urls)` (its path in one of them), both exported for language switchers that
need more than the alternates. `toBcp47(code)` turns `pt_BR` into `pt-BR`.

### Taxonomies

`taxonomies` maps a taxonomy type (`category`, `tag`) to its path segment in every locale. A type without a key has
no listing pages.

```ts
const urls = createUrls({
	localePaths: { en: '', pt_BR: 'br', es: 'es' },
	pageSegments: { pt_BR: 'pagina' },
	taxonomies: {
		category: { en: 'category', pt_BR: 'categoria', es: 'categoria' },
		tag: { en: 'tag', pt_BR: 'tag', es: 'etiqueta' }
	}
})

urls.taxonomy(category, 'en')
urls.taxonomy(category, 'pt_BR', 2)
```

With a category whose slug is `design`, the two calls return `/category/design` and `/br/categoria/design/pagina/2`.
`taxonomy(tag, locale, page?)` takes a `Tag` from `tags.list()` or a `TagRef` from an entry's `categories` and
`tags`, and builds `/<prefix>/<segment>/<slug>`, with `/<pageSegment>/<n>` appended for page `n > 1`. It returns
`undefined` for a type that has no key; `urls.taxonomyTypes` lists the configured types. The slug is the one the API
gave for the requested locale, so link a fallback entry's tags with the locale of the page.

A tag and a category may share a slug, so list a listing's entries with its type:
`tags.entries(tag.slug, { type: tag.type, locale, page })`. Without `type` the API resolves the slug across both
taxonomies (a tag wins a tie), and the listing of a category could show the entries of a tag.

`createUrls` rejects, naming the type and locale: a key other than `category` or `tag`, an empty segment or one with
`/`, a missing segment for a `localePaths` locale or one for a locale `localePaths` lacks, and a segment of the `''`
prefix locale that equals another locale's prefix. With `collections`, it also rejects a segment whose URLs a route
already produces (`routes "<key>" and "taxonomies.category" produce the same URLs`, also between the two types). A
route with more fixed segments wins over a taxonomy listing (a `/{locale}/category/news/{slug}` route makes the
category `news` unreachable); such overlaps are not detected.

The [`@rushcms/astro` README](https://github.com/rush-cms/js/tree/main/packages/astro#routes) shows these helpers in
routes, entry pages, redirects and sitemaps.

## Nested field values

`entry.data`, `homepage.sections[].values`, the values of a site option group, Block values and the values of a rich-text
custom block are typed by the API contract instead of being free objects. `FieldValues` is a record of `FieldValue`s;
`BlockValues`, `RepeaterItem`, `NestedRepeaterItem` and `ExpandedDatabaseItem` are exported for the nested shapes.

- A repeater is an array of items, each with a server-assigned `_id` (use it as the list key) plus the declared
  sub-fields. A repeater may contain one more repeater (`NestedRepeaterItem`); that is the deepest level.
- A database field is always an array of `ExpandedDatabaseItem` (`id`, `name`, `description`, `parent_id`) resolved in
  the requested locale, also when the field allows a single choice.
- A Block field holds `{ block, values }`, with `values` typed as `BlockValues`. Blocks cannot contain block fields.

```ts
import type { ExpandedDatabaseItem, FieldValue, RepeaterItem } from '@rushcms/client'

function isRepeater(value: FieldValue | undefined): value is RepeaterItem[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === 'object' && item !== null && '_id' in item)
	)
}

const menu = (await rush.entries.get('menus', 'lunch-menu')).data

if (isRepeater(menu.courses)) {
	for (const course of menu.courses) {
		console.log(course._id, course.title)
	}
}
```

Narrow a `FieldValue` before reading it; the union covers strings, numbers, booleans, string lists, rich text,
database items, repeaters and Block values.

## Navigation and content helpers

- `navigationLinks(items, urls, locale)` turns the items of a navigation into `NavigationLink[]`: `label`, `href`,
  `target`, `rel` (the deduplicated union of `nofollow`, `noreferrer`, `noopener` for `_blank` and the tokens of the
  item's `rel` attribute), `className`, the other attributes as strings and `children`. An item whose target has no
  route keeps no `href` and stays only when it has children.
- `optional(promise)` resolves `undefined` when the request fails with `not_found` and rethrows anything else, for
  content a site may not have yet (a navigation, a form). Other 404s, such as `not_translated` for a homepage or `moved` for an entry, are thrown with their params.
- `isRichText(value)` tells whether a value is a TipTap document (`RichText`), for rendering entry data generically.

`@rushcms/client/internal` is an undocumented subpath for the other Rush packages and may change in any release.

## License

MIT
