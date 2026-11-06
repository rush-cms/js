# @rushcms/client

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
