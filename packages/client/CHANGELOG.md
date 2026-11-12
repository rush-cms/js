# @rushcms/client

## 5.0.2

### Patch Changes

- [`3ef4aba`](https://github.com/rush-cms/js/commit/3ef4abaf04d1973f1917a87560e6ea9440f7cc72) Thanks [@rmarsigli](https://github.com/rmarsigli)! - `optional` resolves `undefined` only for the `not_found` error code, as documented. `moved` and `not_translated` 404s are rethrown instead of being swallowed, so callers can read their redirect and alternate params.

## 5.0.1

### Patch Changes

- [`287358d`](https://github.com/rush-cms/js/commit/287358d6b96742de4a801aaa5d84fac9972a353e) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Fail with an `invalid_response` error that names the configured and the final origin when a response was redirected to another origin (an `http://` API URL redirected to `https://`), instead of a bare 401 after the `Authorization` header is dropped.

## 5.0.0

### Major Changes

- [`ea216eb`](https://github.com/rush-cms/js/commit/ea216eb6dc5a9c1215340c19bc80455ecefa72a4) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Breaking for TypeScript users: nested field values are typed. The API contract now describes `Entry['data']`, homepage section values, site option group values, Block values and rich-text custom block values with named schemas instead of free objects, and the generated types follow. Runtime behaviour does not change.
  
  Existing code that compiled against the free-object types can stop compiling:
  
  - A field value is a `FieldValue` (string, number, boolean, string list, `RichText`, database items, repeater items or a Block value) instead of `unknown`; narrow it before use, and values you construct for typed fixtures must match.
  - A repeater item requires a string `_id`, and repeaters nest at most one level (`NestedRepeaterItem`); items without `_id` no longer type-check.
  - A database field value is an array of `ExpandedDatabaseItem` (`id`, `name`, `description`, `parent_id`), also for single-choice fields.
  - Block values cannot contain block fields.
  - Admin field widths are no longer served on public Block definitions.
  
  New exported types: `FieldValue`, `FieldValues`, `BlockValue`, `BlockValues`, `RepeaterItem`, `NestedRepeaterItem`, `ExpandedDatabaseItem`. `@rushcms/astro` moves its `@rushcms/client` range to the new major, so sites typed against the old client types may need the same adjustments.

## 4.1.0

### Minor Changes

- [`3cee317`](https://github.com/rush-cms/js/commit/3cee3179e14a1fd579152890c87ebf4a0b604fa6) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Taxonomy listing URLs for categories and tags.
  
  - `createUrls({ taxonomies })`: `category` and `tag` map to a path segment per locale. Each segment must be non-empty
    and free of `/`, exist for every `localePaths` locale and only for those, and, for the `''` prefix locale, differ
    from every other locale's prefix. With `collections`, a segment whose URLs a route already produces throws
    `routes "<key>" and "taxonomies.<type>" produce the same URLs` (also between the two types).
  - `urls.taxonomy(tag, locale, page?)` builds `/<prefix>/<segment>/<slug>`, plus `/<pageSegment>/<n>` for page `n > 1`,
    from a `Tag` or a `TagRef`; `undefined` when the type has no segment. `urls.taxonomyTypes` lists the configured
    types.
  - `urls.match` answers `{ kind: 'taxonomy', locale, type, slug, page }` (`TaxonomyMatch`) for those paths. `UrlMatch`
    gains that member, so an exhaustive `switch` over `match.kind` needs a `taxonomy` case.
  - `tags.entries(slug, { type })` restricts the slug to one taxonomy (the API contract gained the `type` query), so a
    category and a tag that share a slug list their own entries.
  - New exported types: `RushTaxonomies`, `RushTaxonomySegments`, `TaxonomyMatch`, `TagRef`, `TagType`.

## 4.0.0

### Major Changes

- [`7e108ff`](https://github.com/rush-cms/js/commit/7e108ff8734f2ac6992121fed3c4d4fb093d1645) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Breaking: a URL exists only when a route declares it. 4.0 removes the implicit default route, requires `{locale}` in
  every pattern, fails misconfigured routes loudly and moves `isRecord` out of the public API. 3.0.0 is two days old, so
  the migration is short.
  
  Breaking changes and how to migrate:
  
  - No implicit route. 3.x gave every collection without a `routes` key the pattern `/{locale}/{collection}/{slug}`.
    Now a collection without a matching key has no URL: `urls.entry`, `urls.translation`, `urls.servedPath`,
    `urls.collection` and `urls.moved` throw `collection "<slug>" has no route`, and `urls.navigationItem` returns
    `undefined`. Migration: declare the routes you use. `routes: { '*': '/{locale}/{collection}/{slug}' }` restores the
    old behaviour for every collection; one key per public collection (a collection id or any locale's slug) keeps
    data-only collections off the site. A specific key always wins over `'*'`. Check with the new `urls.routed(collection)`.
  - `{locale}` is required in every pattern. `createUrls` throws `route "<key>" must contain {locale}`; before, a
    multi-locale site with `/blog/{slug}` silently produced the same URL in every locale. Migration: add the segment
    (`/{locale}/blog/{slug}`); it collapses for the locale whose prefix is `''`, so single-locale URLs do not change.
  - More configuration errors, thrown by `createUrls` instead of producing wrong or ambiguous URLs:
    `route "*" must contain {collection}`;
    `route "<key>" matches no collection` (a typo or a slug renamed in the CMS; checked when `collections` is given);
    `collection slug "<slug>" equals the locale prefix "<prefix>"` (a pattern puts `{collection}` right after `{locale}`,
    a locale has the `''` prefix and another locale's prefix equals a collection slug in that locale);
    `routes "<a>" and "<b>" produce the same URLs`. Migration: fix the route or the prefix the message names.
  - `isRecord` is no longer exported from the package root. Migration: use `isRichText` for rich text fields, or your
    own type guard for other values.
  - `urls.collection(collection, locale)` takes a third argument, `page`. Page 1 or omitted is the index URL as before;
    page `n > 1` is `<index>/<segment>/<n>` (`/blog/page/2`); anything that is not a positive integer throws.
    Migration: none for existing calls; use it instead of building pagination URLs by hand.
  - `RushUrls` gained members (`routed`, `match`), so a hand-written implementation of the type needs them.
  - The package declares `"engines": { "node": ">=24" }`, as the README always required.
  
  Additions:
  
  - `urls.match(pathname)`: the inverse of URL building from the same `routes`, `localePaths` and `collections`. It
    returns `{ kind: 'entry', locale, collection, slug }`, `{ kind: 'collection', locale, collection, page }`,
    `{ kind: 'homepage', locale }` or `undefined`. Each segment is decoded once, a trailing or repeated slash is ignored
    and upper-case or code-form locale segments (`/EN/blog`, `/pt_BR/blog`) give `undefined`. It needs `collections`.
    Types `UrlMatch`, `EntryMatch`, `CollectionMatch`, `HomepageMatch`.
  - `pageSegments` (`RushPageSegments`, a locale code to a segment, default `page`) in `createUrls`; an empty segment or
    one containing `/` throws.
  - `urls.routed(collection)`: whether a `routes` key matches a collection.
  - `urls.collectionKeys` also takes a collection (`CollectionRef`): its id, its slug and its slug in every locale of
    `collections`, the keys a `routes` key or a per-collection map can use.
  - `navigationLinks(items, urls, locale)` and the `NavigationLink` type: label, `href`, `target`, `rel` (the
    deduplicated union of `nofollow`, `noreferrer`, `noopener` for `_blank` and the tokens of the item's `rel`
    attribute), `className`, the other attributes as strings and `children`. An item with no target, or an unrouted one,
    has no `href` and stays only when it has children.
  - `optional(promise)`: resolves `undefined` on a `not_found` error and rethrows anything else.
  - `isRichText(value)` and the `RichText` type: a check for TipTap documents in entry data.

## 3.0.0

### Major Changes

- [`dac47f7`](https://github.com/rush-cms/js/commit/dac47f72a776b74b974a32a8138825e58644d4ab) Thanks [@rmarsigli](https://github.com/rmarsigli)! - Breaking: 3.0 is a rewrite, not an upgrade of 2.x. 2.x talks to the Rush CMS v1 (Laravel) API; 3.x is built on the
  Rush CMS v2 public API contract (`/api/v1/{site_id}/…` with the site ULID and a Bearer delivery token) and keeps
  nothing of the 2.x API.
  
  Migration: sites on the v1 API stay on 2.x. For v2, create the client with `createClient({ url, siteId, token })`
  (optionally `locale`, `perspective`, `routes`, `localePaths`), read through its resources (`site`, `collections`,
  `entries`, `homepage`, `navigations`, `siteOptions`, `tags`, `blocks`, `databases`, `linkPages`, `forms`) and handle
  failures as `RushError` with the contract `code` (`isRushError(err, 'moved')`).
  
  URL helpers: `createUrls({ routes, localePaths, collections })`. `routes` keys are a collection id or any locale's
  collection slug; `collections` (type `RushCollections`, built by `listCollectionsByLocale(client, locales)`) lets every helper find a route keyed by another locale's slug. Entry resolution helpers:
  `urls.localeOf(param)` (exact prefix), `urls.localeParam(locale)`, `urls.servedPath(entry, requestedLocale)` (the
  URL that answers for an entry as fetched for a locale, fallback pages included; throws for an entry not fetched for
  that locale), `urls.collectionRef(key, locale)`, `urls.hasCollectionSegment(collection)`, `urls.collectionKeys(entry)`
  and `urls.moved(params)`, which builds the redirect target from `moved` error params alone, picking the route by
  `collection_id`. `moved` params include `collection_id` (type `MovedParams`) from the API release that adds slug
  history; without it `urls.moved` routes by `collection_slug`.
