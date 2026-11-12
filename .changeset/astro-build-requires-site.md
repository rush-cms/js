---
'@rushcms/astro': minor
---

A build without `site` in `astro.config` now fails with an error that names `site`: canonical, `hreflang`, Open Graph and sitemap URLs are built from it, and a build used to ship them on a wrong host. Set `site` before `astro build` (the template reads it from `SITE_URL`). `astro dev` without `site` uses the dev server address, and `astro preview` and `astro check` are unaffected.
