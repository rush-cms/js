---
'@rushcms/client': major
---

Breaking: a URL exists only when a route declares it. 4.0 removes the implicit default route, requires `{locale}` in
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
