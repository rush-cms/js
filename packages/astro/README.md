# @rushcms/astro

Astro integration for [Rush CMS](https://github.com/rush-cms/rush-cms): environment schema, build-time site check,
remote image host, a locale-bound API client for pages, an on-demand forms route and a preview deployment mode.

Requires Astro 7.4 or later and an adapter (`@astrojs/node` in standalone mode is the documented default), because
the forms route is rendered on demand. Pages stay static unless you opt out.

## Setup

```js
import node from '@astrojs/node'
import rush from '@rushcms/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({
	adapter: node({ mode: 'standalone' }),
	security: { allowedDomains: [{ protocol: 'https', hostname: 'www.example.com' }] },
	integrations: [
		rush({
			localePaths: { pt_BR: '', en: 'en' },
			routes: { artigos: '/{locale}/blog/{slug}' },
			seo: { artigos: { title: 'headline', description: 'summary', image: 'cover' } }
		})
	]
})
```

| Option        | Description                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------- |
| `localePaths` | CMS locale code → URL prefix; at most one `''`. Must list exactly the site's active locales. |
| `routes`      | Collection slug (any locale) → URL pattern with `{locale}`, `{collection}`, `{slug}`.        |
| `seo`         | Per collection, the data fields used for title, description and image.                       |

## Environment

Declared through `astro:env`; the token is a secret and never reaches the client bundle or the build output.

| Variable         | Access          | Description                                                  |
| ---------------- | --------------- | ------------------------------------------------------------ |
| `RUSH_API_URL`   | server, public  | API base URL                                                 |
| `RUSH_SITE_ID`   | server, public  | Site ULID                                                    |
| `RUSH_API_TOKEN` | server, secret  | Delivery token                                               |
| `RUSH_MEDIA_URL` | server, public  | Media host, allowed for `astro:assets` (defaults to the API) |
| `RUSH_PREVIEW`   | server, boolean | Preview deployment mode (default `false`)                    |

At build and dev start the integration reads `/site` and `/collections` once per locale. It fails when the set of
`localePaths` keys differs from the site's locales, listing both sets.

## Pages

```astro
---
import { getRush } from '@rushcms/astro'

const rush = getRush(Astro)
const entry = await rush.entries.get('artigos', Astro.params.slug)
---
```

`getRush(Astro)` returns a client bound to the route's locale: `Astro.currentLocale` (with Astro `i18n`) or the
`locale` route param (a `[locale]` route without it), mapped back to the CMS code through `localePaths` by prefix or
code. A value that matches no entry throws; without either, the locale with the `''` prefix is used, else the site's
default locale.
Static builds share one memoized client per locale; on-demand requests and `astro dev` never memoize.

With Astro `i18n`, every route gets a `currentLocale`, and routes outside a locale segment get Astro's
`defaultLocale`. Each Astro locale must therefore match a `localePaths` prefix or code: with
`localePaths: { pt_BR: '', en: 'en' }`, declare `locales: [{ path: 'pt', codes: ['pt-BR'] }, 'en']` (or use `pt_BR` /
`pt-BR` as the code), not a bare `pt`. The forms route does not depend on the page locale.

## Forms

`POST /_rush/forms/[key]` accepts `application/x-www-form-urlencoded`, `multipart/form-data` (forwarded as is, files
included) and `application/json`. It sends the visitor IP (`Astro.clientAddress`) as `X-Rush-Client-IP` and the
captcha token from the `cf-turnstile-response` field or the `X-Captcha-Token` header.

- Requests with `Accept: application/json` get `201 {"data": …}` or `{"code", "params", "errors"}` with the API
  status (`502` when the API cannot be reached or answers garbage). The API's log message is never echoed.
- HTML form posts get `303` back to the same-origin `Referer` (as an absolute URL on the site's origin) with
  `rush_form=<key>&status=sent|error`; a missing or cross-origin referrer redirects to `/`.

Cross-site form posts are rejected by Astro's `security.checkOrigin` (on by default; keep it on). Astro only trusts
the `Host` header for hosts listed in `security.allowedDomains`; without it, the request origin falls back to
`localhost` and real form posts are rejected, so list your production domain. Behind a reverse proxy, Astro reads
`X-Forwarded-For` (the visitor IP) and `X-Forwarded-Host` only for those domains; without them every visitor shares
the proxy's IP in the API's rate limits.

## Preview deployment

Deploy the same site a second time with `RUSH_PREVIEW=true` (read when the site is built or the dev server starts)
and point the CMS preview URL templates at it:

```text
https://preview.example.com/_rush/preview?token={token}&locale={locale}&collection={collection}&slug={slug}
https://preview.example.com/_rush/preview?token={token}&locale={locale}
```

- Every route is rendered on demand and every response carries `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
- `GET /_rush/preview` checks the link with `GET /site`, looks the entry up to build its URL with the configured
  `routes` (the homepage without `collection`/`slug`), stores the token in the `rush_preview` cookie (`HttpOnly`,
  `SameSite=Lax`, `Path=/`, `Secure` except on `localhost`, `127.0.0.1` and `[::1]`, expiring with the link) and
  answers `303` to that page. Bad parameters answer `400`, a rejected or expired link `401`, a missing entry `404`.
- With the cookie, `getRush` reads the draft perspective with the link's token; without it, published content. When
  the API refuses the token (`401`, e.g. `token_expired` after clock skew), that request falls back to published
  content with the delivery token and the response clears the cookie.
- `GET /_rush/preview/exit` clears the cookie and answers `303` to `/`, or to a same-origin `return` path.
- Outside preview mode both routes do not exist and the cookie is never read. Set `security.allowedDomains` here too:
  the redirect and the `Secure` flag follow the request origin Astro trusts. When Astro falls back to `localhost`
  while the `Host` or `X-Forwarded-Host` header names another host, both routes answer `500` (no cookie).
- The token travels in the `/_rush/preview` query string, so it can appear in access logs and browser history; it
  expires one hour after the link is issued. Every hit with a well-formed token costs one `GET /site` (plus the entry
  lookup).
- The preview link token is a draft-reading credential for one hour; it never reaches the browser's JavaScript.
  Form posts from a preview session use it and are refused by the API (`preview_cannot_submit`).

## Rich text and images

```astro
---
import RichText from '@rushcms/astro/components/rich-text.astro'
import Callout from '../components/callout.astro'
---

<RichText content={entry.data.body} media={entry.media} blocks={{ callout: Callout }} />
```

- `blocks` maps a block slug to a component that receives `{values}`; an unmapped block renders nothing.
- `nodes` maps a node type to a component that receives `{node}`; the rendered children arrive in its default slot.
- Text is always escaped. Links are rendered only for `http`, `https`, `mailto`, `tel` and relative `href`s; any other
  scheme renders the text without a link. `rel` is never taken from content (`target="_blank"` gets
  `noopener noreferrer`). Nesting deeper than 32 levels renders nothing.
- An image is joined to `media` by `attrs.mediaId`. Without a media entry (or without its dimensions) a plain
  `<img>` with the API `src` is rendered: it skips Astro's remote-image check and optimization.
- `RushImage` (`@rushcms/astro/components/rush-image.astro`) wraps `astro:assets` `<Image>` with width, height and alt
  from a `media` entry.
