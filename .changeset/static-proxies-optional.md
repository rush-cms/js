---
'@rushcms/astro': patch
'create-rush-cms': patch
---

`trustedProxies` is required only when the integration serves on-demand routes (forms enabled or a preview deployment) and is optional and ignored on a static site; the option only becomes optional, so existing configs keep working. `create-rush-cms --ssg` no longer writes it.
