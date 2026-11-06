---
'@rushcms/astro': minor
---

First release of `@rushcms/astro`, the Astro integration for Rush CMS v2, built on `@rushcms/client` 3. It needs
Astro 7.4 or later and an adapter for the on-demand routes (`@astrojs/node` in standalone mode is the documented
default); pages stay static unless you opt out.

- `rush({ localePaths, routes?, seo?, trustedProxies? })` declares the `astro:env` schema (`RUSH_API_URL`,
  `RUSH_SITE_ID`, `RUSH_API_TOKEN` as a secret that never reaches the client bundle or the build output,
  `RUSH_MEDIA_URL`, `RUSH_PREVIEW`), allows the media host for `astro:assets`, and at build and dev start checks that
  `localePaths` lists exactly the site's locales and loads the collections of every locale.
- `getRush(Astro)` returns a client bound to the page's locale (memoized per locale during static builds) and
  `getUrls(Astro)` the URL helpers of `@rushcms/client` built from the options. The integration middleware answers
  `404` for a `locale` route param that is no `localePaths` prefix.
- Entry pages: `entryPaths(collection)` for `getStaticPaths` in every locale, fallback pages included, and
  `resolveEntry(Astro, route?)`, which returns `found`, `moved` (a redirect location built from the error params,
  `302` in a preview deployment) or `missing`, so one page file works prerendered and on demand, with fixed-collection
  routes in every locale.
- `sitemapResponse` serves an XML sitemap of canonical URLs with `lastmod` and hreflang alternates.
- Components: `<RichText>` (TipTap rich text with site block and node components, safe links), `<RushImage>`
  (`astro:assets` image from the media map), `<Seo>` (title, description, Open Graph, canonical, hreflang), `<Form>`
  (fields from the public form schema, Turnstile, per-field errors, works without JavaScript) and `<PreviewBanner>`.
- `POST /_rush/forms/[key]` forwards urlencoded, multipart and JSON posts with the captcha token, answers JSON to
  `fetch` and `303` to plain form posts, and sends the visitor IP for the API rate limits without ever trusting an
  address the visitor chose (`trustedProxies` counts the reverse proxies in front of the server).
- Preview deployment: the same site built with `RUSH_PREVIEW=true` renders every route on demand with
  `X-Robots-Tag: noindex`, turns CMS preview links (`/_rush/preview`) into an `HttpOnly` cookie session that reads
  drafts, and exits through `/_rush/preview/exit`.
