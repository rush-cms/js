---
'@rushcms/astro': minor
---

`<Seo page>` emits the same head as the entry and homepage forms for any other page, such as a collection list or a taxonomy page (`locale`, `canonical`, `title`, `description`, `alternates`, `image`). Every form now emits the Twitter card tags, takes `titleSuffix` (appended to `<title>` only) and writes `og:locale` and `og:locale:alternate` in the Open Graph form (`pt_BR`). `RushImage` is responsive: it emits `srcset` and `sizes` on the media host, takes `layout`, `widths`, `priority` and `aspectRatio`, reads the size of a media without dimensions from the image itself and reserves an aspect box when it cannot. The sitemap no longer lists a collection list page in a locale whose listing is empty.

Markup change for existing `RushImage` users on the media host: images now default to Astro's `constrained` layout, so they carry `srcset`, `sizes` and the `data-astro-image` attributes, their transform URLs add `fit=cover`, a static build generates one variant per width (up to nine per image), and with `image.responsiveStyles: true` Astro's responsive CSS applies to them. Pass `layout="none"` to keep the 0.3 markup. `SeoPage` and `ImageLayout` are exported from `@rushcms/astro`. The undocumented internal subpath `@rushcms/astro/components-runtime` no longer exports `entrySeo`, `homepageSeo`, `SeoSettings`, `SeoTags` or `SeoImage`.
