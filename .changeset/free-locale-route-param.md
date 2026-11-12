---
'@rushcms/astro': patch
---

A route param named `locale` that is not a `localePaths` prefix no longer throws in `getRush`, and the middleware no longer answers 404 for it on prerendered routes: the locale falls back to `Astro.currentLocale`, the request path or the default locale.
