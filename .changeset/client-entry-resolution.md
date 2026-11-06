---
'@rushcms/client': major
---

First 3.x release, built on the Rush CMS public API contract. Adds entry resolution helpers to `createUrls`:
`urls.localeOf(param)` maps a URL locale segment back to its locale by exact prefix, `urls.localeParam(locale)` gives
the route param of a locale, `urls.entryPathIn(entry, locale)` gives the URL that answers for an entry in a locale
(fallback pages included) and `urls.moved(params)` builds the redirect target from `moved` error params, picking the
route by `collection_id`. `moved` params now include `collection_id` (exported as `MovedParams`).
