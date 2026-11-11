---
'@rushcms/astro': patch
'create-rush-cms': patch
---

Docs: a prefixed `404.astro` builds to `dist/<prefix>/404/index.html` with Astro's default build format, not `dist/<prefix>/404.html`; the nginx examples point there.
