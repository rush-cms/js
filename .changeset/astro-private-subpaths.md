---
'@rushcms/astro': minor
---

`@rushcms/astro/components-runtime` and `@rushcms/astro/form-enhance` are no longer exported: they were internal helpers of the shipped components and are now private `#components-runtime` and `#form-enhance` imports. Code that imported them directly must stop; nothing documented used them.
