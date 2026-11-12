---
'@rushcms/astro': patch
---

The error for a route whose `locale` param matches no `localePaths` prefix now names the route, the value and the configured prefixes, says that `locale` is the param name reserved for the locale prefix and suggests renaming it. A prerendered route fails the build with it instead of getting a silent 404.
