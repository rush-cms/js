# @rushcms/astro

Astro integration for [Rush CMS](https://github.com/rush-cms/rush-cms): environment schema, build-time site check,
remote image host, a locale-bound API client for pages, an on-demand forms route and a preview deployment mode.

Requires Astro 7.4 or later and the Node adapter (`@astrojs/node`, standalone mode documented here), because the
forms route is rendered on demand and resolves the visitor IP from what that adapter reads (see
[Visitor IP](#visitor-ip)). Pages stay static unless you opt out.

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
			routes: { artigos: '/{locale}/blog/{slug}', '*': '/{locale}/{collection}/{slug}' },
			pageSegments: { pt_BR: 'pagina' },
			seo: { artigos: { title: 'headline', description: 'summary', image: 'cover' } },
			trustedProxies: 1
		})
	]
})
```

| Option           | Description                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `localePaths`    | Required. CMS locale code → URL prefix; at most one `''`; exactly the site's active locales.         |
| `routes`         | Collection id, slug (any locale) or `'*'` → URL pattern (see [Routes](#routes)).                     |
| `pageSegments`   | CMS locale code → segment of collection list pages after the first (default `page`).                 |
| `taxonomies`     | `category` / `tag` → CMS locale code → segment of its listing pages (see [Taxonomies](#taxonomies)). |
| `seo`            | Per collection, the data fields used for title, description and image.                               |
| `trustedProxies` | Required. Reverse proxies in front of the server that append to `X-Forwarded-For`.                   |

## Routes

A collection has URLs only when a `routes` key matches it; there is no implicit route. A key is a collection id, a
collection slug of any locale, or `'*'`, which matches every collection no other key matches (a specific key always
wins). A collection without a matching key has no entry pages, no list page, no sitemap entries and no navigation
links. `routes: { '*': '/{locale}/{collection}/{slug}' }` gives every collection the generic shape; replacing `'*'`
with one key per public collection keeps data-only collections off the site.

Every pattern contains `{locale}` (it collapses for the `''` prefix, so a single-locale site has no locale segment and
adding a locale later changes no URL); `{slug}`, when present, is the last segment; the `'*'` pattern contains
`{collection}`. The list page of a collection is its pattern without `{slug}`; page `n > 1` appends
`<segment>/<n>`, where the segment is `pageSegments[locale]` or `page` (`/blog/pagina/2`, `/en/blog/page/2`), built by
`urls.collection(collection, locale, page)`.

Mistakes fail when Astro loads the config (pattern rules, an empty `pageSegments` value or one with `/`) or at build
and dev start, once the site's collections are known:

- `route "<key>" must contain {locale}`, `route "*" must contain {collection}`;
- `route "<key>" matches no collection`: a typo, or a slug renamed in the CMS;
- `collection slug "<slug>" equals the locale prefix "<prefix>"`: a pattern puts `{collection}` right after
  `{locale}`, a locale has the `''` prefix, and that locale's slug of a collection equals another locale's prefix;
- `routes "<a>" and "<b>" produce the same URLs`: two routes whose URLs cannot be told apart.

A collection slug equal to a fixed page of the site (`contact`, `sitemap.xml`) is not detected.

## Taxonomies

Categories and tags get listing pages only when `taxonomies` names their type, with one path segment per locale:

```js
rush({
	localePaths: { en: '', pt_BR: 'br', es: 'es' },
	pageSegments: { pt_BR: 'pagina' },
	taxonomies: {
		category: { en: 'category', pt_BR: 'categoria', es: 'categoria' },
		tag: { en: 'tag', pt_BR: 'tag', es: 'etiqueta' }
	},
	trustedProxies: 1
})
```

The listing of a category is `/<prefix>/<segment>/<slug>` (`/category/design`, `/br/categoria/design`), page `n > 1`
appends `<pageSegments[locale]>/<n>` (`/br/categoria/design/pagina/2`, `/category/design/page/2`), and
`urls.taxonomy(tag, locale, page?)` builds it from a `Tag` or from the `TagRef` of an entry's `categories` and `tags`
(`undefined` for a type without a key). Every page lists the entries of `tags.entries(slug, { type, locale, page })`
with the tag's own type, so a category and a tag that share a slug keep their own listings. The entries come from every
collection, in the API's order and page size (15 per page), fallback entries included.

A `TaxonomyPage` carries `alternates`: the same tag (by id) in every locale where it has entries, as `Alternate[]` with
URLs of page 1, for the language switcher and `hreflang` links. A locale where the tag has no entries is left out.
Outside the dispatcher, `taxonomyAlternates(tag, client, urls)` returns the same list, with one `tags.list({ type,
locale })` request per locale. `alternateLinks(alternates, defaultLocale)` turns such a list into `hreflang` links with
`x-default`, and `absoluteLinks(links, site)` makes their URLs absolute.

`sitePaths()` lists every page of every tag whose `entry_count` in that locale is above `0`, for every configured
type and locale, and `resolvePage` answers such a path on demand. The sitemap lists page 1 of each of them. A tag
whose listing has no entries in a locale has no page there.

A segment is checked like `pageSegments` when Astro loads the config (not empty, no `/`), and must exist for every
`localePaths` locale and only for those; a key other than `category` or `tag` fails too. The segment of the `''`
prefix locale must not equal another locale's prefix. At build and dev start, a segment whose URLs a collection route
already produces fails with `routes "<key>" and "taxonomies.<type>" produce the same URLs` (also between the two
types).

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
`localePaths` keys differs from the site's locales, listing both sets and a value to paste:

```text
@rushcms/astro: localePaths locales [] differ from the site locales [pt_BR, en, es]. Set in astro.config:
  localePaths: { pt_BR: '', en: 'en', es: 'es' }
```

The suggestion gives the default locale the `''` prefix and every other locale its lower-case language subtag, or its
full lower-case code with `-` when two locales share that subtag (`pt-br`, `pt-pt`). The collection slugs of every
locale are kept in the site config, so a `routes` or `seo` key (a collection id or any locale's slug) and the
collection segment of an entry page resolve in every locale, and the routes are checked against them (see
[Routes](#routes)).

## Pages

```astro
---
import { getRush } from '@rushcms/astro'

const rush = getRush(Astro)
const entry = await rush.entries.get('artigos', Astro.params.slug)
---
```

`getRush(Astro)` returns a client bound to the route's locale: the `locale` route param, matched against the
`localePaths` prefixes only (`pt_BR` or `pt-BR` in the URL never match), else `Astro.currentLocale` (with Astro
`i18n`), matched by prefix or CMS code (`pt-BR`, `pt_BR`, any case). A value that matches nothing throws. Without
either (the `[...path]` dispatcher, `404.astro`, `/sitemap.xml`), the locale comes from the request path: the locale of
`urls.match(Astro.url.pathname)`, else the locale whose non-empty prefix equals the first path segment (`/en/contact`
→ `en`), else the locale with the `''` prefix, else the site's default locale. `getLocale(Astro)` returns that locale
(for `<html lang>` or a home link on a `404` page); `getNavigation` and every helper that takes `Astro` resolve the
locale the same way.
The integration middleware answers `404` before any page renders when a route has a `locale` param that is not a
`localePaths` prefix (`/pt_BR/…`, `/PT/…`), so on-demand routes never reach that throw; name a route param `locale`
only on the site's locale segment.
Static builds share one memoized client per locale; on-demand requests and `astro dev` never memoize.

The helpers that take `Astro` read `locals`, `params`, `currentLocale`, `isPrerendered` and `url` (`RushContext`); a
context built by hand, in a script or a test, must carry all five.

With Astro `i18n`, every route gets a `currentLocale`, and routes outside a locale segment get Astro's
`defaultLocale`. Each Astro locale must therefore match a `localePaths` prefix or code: with
`localePaths: { pt_BR: '', en: 'en' }`, declare `locales: [{ path: 'pt', codes: ['pt-BR'] }, 'en']` (or use `pt_BR` /
`pt-BR` as the code), not a bare `pt`. The forms route does not depend on the page locale.

## Navigation

```astro
---
import { getNavigation } from '@rushcms/astro'
import { optional } from '@rushcms/client'

const main = (await optional(getNavigation(Astro, 'main'))) ?? []
---

<nav>
	{
		main.map((link) => (
			<a href={link.href} target={link.target} rel={link.rel} class={link.className} {...link.attributes}>
				{link.label}
			</a>
		))
	}
</nav>
```

`getNavigation(Astro, key)` fetches the navigation `key` in the page's locale (found as for `getRush`, drafts in a
preview session) and returns `navigationLinks(items, getUrls(Astro), locale)` from `@rushcms/client`. Each link has
`label`, `href` (entry and collection targets built from `routes`), `target`, `rel` (`nofollow`, `noreferrer`,
`noopener` for `_blank` and the tokens of the item's `rel` attribute, without duplicates), `className`, the other
`attributes` as strings, and `children`. An item whose target has no route keeps no `href` and stays only when it has
children.

Like every helper, it throws a `RushError` with code `not_found` for an unknown key. `optional(promise)` from
`@rushcms/client` resolves `undefined` on a `404` and rethrows anything else, for content a site may not have yet (a
navigation, the homepage, a form).

## Forms

`POST /_rush/forms/[key]` accepts `application/x-www-form-urlencoded`, `multipart/form-data` (forwarded as is, files
included) and `application/json`. It sends the visitor IP as `X-Rush-Client-IP` (see below) and the captcha token from
the `cf-turnstile-response` field or the `X-Captcha-Token` header.

- Requests with `Accept: application/json` get `201 {"data": …}` or `{"code", "params", "errors"}` with the API
  status (`502` when the API cannot be reached or answers garbage). The API's log message is never echoed.
- HTML form posts get `303` back to the same-origin `Referer` (as an absolute URL on the site's origin) with
  `rush_form=<key>&status=sent|error`; a missing or cross-origin referrer redirects to `/`.

Cross-site form posts are rejected by Astro's `security.checkOrigin` (on by default; keep it on). Astro only trusts
the `Host` header for hosts listed in `security.allowedDomains`; without it, the request origin falls back to
`localhost` and real form posts are rejected, so list your production domain.

### Visitor IP

The API rate-limits form posts per visitor IP (5 per minute per form) and per site, and stores the IP with the
submission. The forms route never forwards an address the visitor chose. Which address is the visitor's depends on how
requests reach the server, so `trustedProxies` has no default; without a non-negative integer, `rush()` fails when
Astro loads the config:

```text
@rushcms/astro: trustedProxies is required and must be a non-negative integer, got undefined. Use 0 when visitors
reach the Astro Node server directly, or n when every request reaches it through n reverse proxies that each append
to X-Forwarded-For.
```

- `trustedProxies: 0`, visitors reach the Node server directly. The route sends `Astro.clientAddress` only when it is
  not one of the request's `X-Forwarded-For` entries. For a host in `allowedDomains`, Astro copies the leftmost
  `X-Forwarded-For` entry, which any client can set, into `clientAddress`, and the raw socket address is no longer
  readable; such a post is sent without `X-Rush-Client-IP`, so the API counts it against the server's own address and
  stores that address. Every visitor that sends the header, on purpose or through a forward proxy that adds it, lands
  in that one shared bucket: a second budget of 5 posts per minute per form, which those visitors can also use up for
  each other. The first post that carries `X-Forwarded-For` logs a warning through Astro's logger, once per process.
- `trustedProxies: n`, the server is reached only through `n` reverse proxies, each appending the address it was
  connected from to `X-Forwarded-For`. The route sends the `n`-th entry from the right (the address the outermost
  proxy saw) and ignores `clientAddress` and every entry to its left. When the header has fewer than `n` entries or
  that entry is not a bare IPv4/IPv6 address (no port), no IP is sent and a warning is logged once per process.

Only `X-Forwarded-For` is read; `Forwarded`, `X-Real-IP` and `CF-Connecting-IP` are ignored. These guarantees hold for
`@astrojs/node`, the only adapter the forms route supports.

#### Behind reverse proxies

| Topology                                         | `trustedProxies` | Also required                                                                   |
| ------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------- |
| Node server reached directly                     | `0`              | nothing                                                                         |
| Coolify (Traefik) → Node                         | `1`              | The app port not published on the host (no Coolify port mapping)                |
| nginx → Node                                     | `1`              | `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`                   |
| Cloudflare → Traefik or nginx → Node             | `2`              | Traefik `forwardedHeaders.trustedIPs` and origin lockdown (below)               |
| Cloudflare Tunnel (cloudflared → Traefik) → Node | check, see below | Traefik `forwardedHeaders.trustedIPs` listing the cloudflared container network |

- Every hop is locked down, not only the last one. The Node server accepts connections only from the innermost proxy
  (bind it to a private interface or firewall it), and each proxy accepts connections only from the next one out.
  Otherwise a client that connects to an inner hop directly writes the entries the route trusts: with Cloudflare in
  front of Traefik and `trustedProxies: 2`, a header forged in a request sent straight to Traefik is picked. Firewall
  the origin proxy to Cloudflare's published IP ranges, or require Cloudflare Authenticated Origin Pulls.
- Every proxy must append the address it was connected from (nginx `$proxy_add_x_forwarded_for`); the outermost one
  may instead replace the header with it (`$remote_addr`).
- Traefik drops the `X-Forwarded-*` headers it receives and starts a new `X-Forwarded-For` unless the sender is listed
  in the entry point's `forwardedHeaders.trustedIPs`. That is what makes it a safe outermost proxy; behind Cloudflare,
  list Cloudflare's IP ranges there, or the header arrives one entry short and no IP is sent.
- Cloudflare Tunnel: Traefik must list the network cloudflared connects from in `forwardedHeaders.trustedIPs`, or it
  drops the header. Set `trustedProxies` by checking which `X-Forwarded-For` entries reach the server, and calibrate
  with the warning: it fires when the entry at that position is missing or not a bare IP.
- A CDN in front of a proxy counts as one more hop. With a count lower than the real chain, every visitor gets a
  proxy's address; with a higher one, the visitor can choose the address.

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
  content with the delivery token and the response clears the cookie. When that 401 happens in a component rendered
  after the response started streaming, the request still shows published content, but the cookie is cleared only on
  a later request.
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
- An image is joined to `media` by `attrs.mediaId` (falling back to the node's `src` without a media entry) and
  rendered through `RushImage`.
- `RushImage` (`@rushcms/astro/components/rush-image.astro`) renders `astro:assets` `<Image>` with width, height and
  alt from a `media` entry. While the media has no dimensions (the media worker has not processed it yet, or the
  image is not in `media`) it renders a plain `<img src alt loading="lazy" decoding="async">` with the other props,
  which skips Astro's remote-image check and optimization. Without a media URL it renders nothing.

## SEO

```astro
---
import Seo from '@rushcms/astro/components/seo.astro'
---

<head>
	<Seo entry={entry} />
</head>
```

Set `site` in `astro.config`: absolute URLs are built from it and `<Seo>` throws without it.

- `<Seo entry>` emits `<title>`, the meta description, Open Graph (`og:title`, `og:description`, `og:image` with
  width and height when the media has them, `og:url`, `og:type`, `og:locale` and `og:locale:alternate` in BCP 47),
  `rel="canonical"` and `<link rel="alternate" hreflang>` for every translation, plus `x-default` pointing at the
  site's default locale when that translation exists.
- Title, description and image come from the `seo` option for the entry's collection (keyed by the collection id or
  the collection slug of any locale), naming data fields. Defaults: `title`, `excerpt`, `featured_image`. A mapped
  field that is empty falls back to the default.
- Canonical always points at the original translation, so a fallback page (an entry shown in a locale it is not
  translated to) is canonical to the original locale's URL.
- `<Seo homepage>` reads `meta.title`, `meta.description` and `meta.og_image` (a blank value emits no tag), lists
  hreflang links for the homepage's `translations` and points canonical at the homepage's own locale.
  `homepageTitle(homepage)` returns the title it would emit, or `undefined` (no homepage, or a missing or blank
  `meta.title`), so a page can fall back to a title of its own only then.

## Forms component

```astro
---
import Form from '@rushcms/astro/components/form.astro'

const form = await getRush(Astro).forms.get('contact')
---

<Form form={form} messages={{ required: 'Required', sent: 'Thanks!', error: 'Something went wrong' }} />
```

- Renders the fields of the public form schema and posts to `/_rush/forms/<key>`; it works without JavaScript (the
  route redirects back with `rush_form=<key>&status=sent|error`, shown above the fields). With JavaScript the form is
  sent with `fetch`, the status is shown in place and each field error appears under its field.
- `messages` maps error codes (`required`, `invalid_email`, `too_short`, …) and the statuses `sent` and `error` to
  text; `{min}`, `{max}` and `{value}` placeholders are replaced from the error params. A missing key shows the code.
- The server-rendered status needs the page to be rendered on demand; on a static page the script shows it instead.
- The Turnstile widget and its script are added only when the form schema has `captcha`. The honeypot input is
  rendered when the schema has one.

## Preview banner

`<PreviewBanner />` (`@rushcms/astro/components/preview-banner.astro`) renders only in a preview deployment while a
preview cookie session is active, with a link to `/_rush/preview/exit` that returns to the current page. `label` and
`exitLabel` props set its texts.

## Dispatcher route

The recommended setup is one page for every URL the SDK builds (homepages, collection list pages, taxonomy listings,
entries) plus an
on-demand `404.astro` for old URLs. Changing URLs then only means changing `routes`, `localePaths` or
`pageSegments`; no page file encodes a URL shape. `src/pages/[...path].astro`:

```astro
---
import { resolvePage } from '@rushcms/astro'
import type { SitePageProps } from '@rushcms/astro'

export * from '@rushcms/astro/site-paths'

type Props = SitePageProps

const page = await resolvePage(Astro)
if (page.kind === 'moved') {
	return Astro.redirect(page.location, page.permanent ? 301 : 302)
}
if (page.kind === 'missing') {
	return new Response(null, { status: 404 })
}
---
```

`src/pages/404.astro`:

```astro
---
import { resolvePage } from '@rushcms/astro'

export const prerender = false

const page = await resolvePage(Astro)
if (page.kind === 'moved') {
	return Astro.redirect(page.location, page.permanent ? 301 : 302)
}
Astro.response.status = 404
---
```

`sitePaths(rush?)` returns `{ params: { path }, props: { page } }` for the homepage of every locale, every list page
of every routed collection in every locale (pages `1..meta.last_page`, `per_page` set to the collection's
`items_per_page`), every entry of every routed collection (as `entryPaths`, fallback pages included) and every
taxonomy listing page (see [Taxonomies](#taxonomies)). `path` has
no leading slash and is `undefined` for `/`. A URL is listed once: when a root pages route (`'/{locale}/{slug}'`)
makes a list page 1 equal to a homepage URL, the homepage wins. Pass a client as `rush` to override the default one.

`@rushcms/astro/site-paths` exports `getStaticPaths` alone, which calls `sitePaths()`. Re-export it with `export *`:
Astro warns `getStaticPaths() ignored in dynamic page` whenever an on-demand page's code contains the text
`getStaticPaths`, and every page is on demand in a preview deployment, so the re-export keeps preview builds free of
that warning while production builds still prerender every path. `export const getStaticPaths = () => sitePaths()`
works too, with the warning in preview builds. Never write `export const getStaticPaths = sitePaths`: Astro passes
its own options object, which would arrive as `rush`.

`resolvePage(Astro)` returns one of:

- the `page` prop from `getStaticPaths` when present, without a request;
- otherwise, from `urls.match(Astro.url.pathname)`, fetched with the client of the matched locale (drafts in a
  preview session):
    - `{ kind: 'homepage', locale, homepage }`: `homepage` is `undefined` when the locale has none;
    - `{ kind: 'collection', locale, collection, page, lastPage, entries }`: `entries` is the `entries.list` page
      (`items`, `meta`) and `lastPage` is `meta.last_page`, at least 1 (an empty collection has page 1); a page past
      `lastPage` is `missing`, and so is a collection the API no longer has;
    - `{ kind: 'taxonomy', locale, tag, page, lastPage, entries }`: `tag` is the `Tag` of the path's type and slug
      in `tags.list({ type, locale })`, `entries` the `tags.entries` page; a tag that is unknown or has no entries in
      that locale is `missing`, and so is a page past `lastPage`;
    - an entry through `resolveEntry`: `{ kind: 'found', entry, locale }`, `moved` or `missing`;
- `{ kind: 'missing' }` for a path no route names.

In a production build every listed path is prerendered and the Node server hands every other path to `404.astro`,
which redirects retired slugs and other locales' slugs (`moved`) and answers `404` otherwise. In a preview
deployment the dispatcher itself renders on demand, so the same `resolvePage` call fetches drafts and answers
`moved` there. Static pages such as `src/pages/[...locale]/contact.astro` take precedence over the dispatcher's
rest parameter.

## Entry pages

A page file per URL shape (`resolveEntry` with `entryPaths`) remains valid only when every locale has a prefix. With
a `''` prefix the shapes become ambiguous on demand (every route of a preview deployment, and the catch-all of a
production build): Astro ranks routes by their segments, not by `localePaths`, so `[...locale]/[collection]/[slug]`
also answers `/en/blog` as `{ collection: 'en', slug: 'blog' }` next to `[...locale]/[collection]/index.astro`, the
rest parameter swallows extra segments, and a `404` from the first route does not fall through to the next. Use the
[dispatcher route](#dispatcher-route) for such sites.

One page file serves a collection both prerendered (production) and on demand (the preview deployment, where every
route is rendered on demand and `getStaticPaths` props never arrive). With
`localePaths: { pt_BR: 'pt', en: 'en' }` and `routes: { artigos: '/{locale}/blog/{slug}' }`,
`src/pages/[locale]/blog/[slug].astro`:

```astro
---
import { entryPaths, resolveEntry } from '@rushcms/astro'
import type { EntryRouteProps } from '@rushcms/astro'

type Props = EntryRouteProps

export const getStaticPaths = () => entryPaths('artigos')

const resolved = await resolveEntry(Astro, { collection: 'artigos' })
if (resolved.kind === 'moved') {
	return Astro.redirect(resolved.location, resolved.permanent ? 301 : 302)
}
if (resolved.kind === 'missing') {
	return new Response(null, { status: 404 })
}
const { entry, locale } = resolved
---
```

`resolveEntry(Astro, route?)` returns one of:

- `{ kind: 'found', entry, locale }`: the `entry` prop from `getStaticPaths` when present, otherwise the entry fetched
  with `getRush` (drafts in a preview session) by the route's `collection` and `slug` params in the route's locale.
  When `collection` names a fixed-collection route (a collection id or any locale's slug whose pattern has no
  `{collection}`, such as `artigos` above) through the `route` override, it is mapped to the collection's slug in the
  route's locale before the request, so the fixed segment serves every locale. When that collection arrives instead
  as a `collection` route param (a `[locale]/[collection]/[slug]` page, where the URL should not exist), the result is
  `moved` to the fixed route in one hop. A collection segment of a `{collection}` route is sent as is, so the API
  answers `moved` for another locale's segment.
- `{ kind: 'moved', location, permanent }`: the API answered `moved` (retired slug, another locale's slug, wrong
  collection segment); `location` is built from the error params alone, without a second request. `permanent` is
  `false` in a preview deployment, where content (and slugs) still change: answer `302` there, `301` otherwise.
- `{ kind: 'missing' }`: `not_found`, `not_translated`, `locale_not_served`, a locale segment that is not a
  `localePaths` prefix (codes such as `pt_BR` do not match), a missing collection or slug, a collection that has no
  route, or a `moved` answer whose target collection has no route.

The locale is found as for `getRush`, but a value that matches nothing gives `missing` instead of throwing.
`route` overrides the `locale`, `collection` and `slug` params, for routes with a fixed collection segment (as above)
or a catch-all route that splits the path itself. Other API errors are thrown.

`entryPaths(collection, rush?)` walks the collection (an id or any locale's slug) in every `localePaths` locale and returns
`{ params, props: { entry } }`; `params` holds the `locale` (undefined for the empty prefix), `collection` and `slug`
of the route pattern that applies to the collection. Entries served as a fallback produce a page under the requested
locale too. It throws, before any request, for a collection that has no route. Pass a client as `rush` to override
the default one.

A static build only answers the paths it generated, so old URLs (retired slugs, another locale's slug) get Astro's
not-found page. To redirect them, add an on-demand catch-all route (`export const prerender = false`) that splits the
path into the same segments and calls `resolveEntry(Astro, { locale, collection, slug })`, redirecting on `moved`
and answering `404` otherwise. For a fixed segment, pass the route key as `collection` (`blog` → `artigos`); a
`found` entry then answers `200` only at its own URL, so redirect to `urls.servedPath(entry, locale)` (from
`getUrls(Astro)`) when that differs from `Astro.url.pathname` and answer `404` only when they are equal.

Links come from `getUrls(Astro)`, the URL helpers of `@rushcms/client` built from the options passed to `rush()`
and the site's collections. `createUrls({ routes, localePaths, collections })` builds the same helpers anywhere else
(`getStaticPaths`, scripts), where `collections` is `await listCollectionsByLocale(client, locales)` from
`@rushcms/client`, each locale's `collections.list({ locale })` reduced to `id` and `slug`. Without `collections`,
route keys are not checked, `urls.match` throws, and a route keyed by one locale's slug is found only through the
slugs an entry carries in its `translations`, so collection pages, navigation targets and `moved` locations in other
locales fall back to `'*'` or have no route. Every helper that builds a URL for a collection without a route throws
`collection "<slug>" has no route`; `urls.navigationItem` returns `undefined` instead.

| Helper                          | Returns                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `urls.routed(c)`                | Whether a `routes` key matches collection `c`.                                          |
| `urls.entry(entry)`             | The canonical URL (the served translation's own locale).                                |
| `urls.collection(c, l, page?)`  | The list page URL of `c` in `l` (page 1 when omitted).                                  |
| `urls.taxonomy(t, l, page?)`    | The listing URL of category or tag `t` in `l` (`undefined` when its type has no key).   |
| `urls.match(pathname)`          | The entry, collection, taxonomy page or homepage a path names (`undefined` when none).  |
| `urls.servedPath(e, requested)` | The URL that answers `200` for `e` as fetched for `requested`, fallback pages included. |
| `urls.translation(e, l)`        | The URL of `e`'s translation in `l` (throws when there is none).                        |
| `urls.moved(params)`            | The URL from `moved` error params, routed by `collection_id` then `collection_slug`.    |
| `urls.hasCollectionSegment(c)`  | Whether the route pattern of collection `c` has a `{collection}` segment.               |
| `urls.collectionRef(key, l)`    | `{ id, slug }` in `l` of the collection a key names (`undefined` when unknown).         |
| `urls.localeOf(param)`          | The locale whose prefix equals a URL segment (`undefined` → the `''` prefix locale).    |
| `urls.localeParam(locale)`      | The `locale` route param of a locale (`undefined` for the `''` prefix).                 |

`urls.servedPath` throws when `e` cannot have been fetched for `requested` (a translated entry fetched in another
locale, or a fallback entry for a locale it has a translation in). `params.collection_id` in `moved` errors comes
with the Rush CMS API release that adds slug history; an older API omits it and `urls.moved` then routes by
`collection_slug` alone.

## Sitemap

```ts
import { sitemapResponse } from '@rushcms/astro'

export const GET = (context) => sitemapResponse({ context, collections: ['artigos'] })
```

`sitemapResponse` answers `application/xml` with the URLs the dispatcher renders, each listed once:

- the homepage of each locale whose CMS homepage is its own (not a fallback), with `lastmod` from that homepage. A
  locale served by another locale's homepage, or answering `404` while another locale has one, is skipped, matching
  `<Seo homepage>`, whose canonical points at the homepage's own locale. When the site has no CMS homepage in any
  locale, the front page of every locale is listed without `lastmod` (the dispatcher renders a static front page);
- page 1 of every listed collection in every locale it exists in, without `lastmod` (later list pages are never
  listed), except an index whose URL is a homepage URL: the dispatcher renders the homepage there;
- canonical entry URLs only (fallback pages are excluded), with `lastmod` from `updated_at`;
- page 1 of every [taxonomy](#taxonomies) listing in every locale where the tag has entries, without `lastmod`,
  whatever `collections` names.

Homepage, collection and taxonomy URLs carry `xhtml:link` alternates to the same page (for a taxonomy, the same tag
id) in the other listed locales, entries to their translations; each adds `x-default` pointing at the site's default locale when that locale's page is listed.
`homepageAlternates(urls)`, `collectionAlternates(collection, urls)` (a collection id or slug) and
`taxonomyAlternates(tag, client, urls)` return the same alternates as `Alternate[]` for a language switcher. Without `collections` it lists every collection that has a
route; naming a collection without a route throws.
