---
'@rushcms/astro': minor
---

`<Seo page>` emits the same head as the entry and homepage forms for any other page, such as a collection list or a taxonomy page (`locale`, `canonical`, `title`, `description`, `alternates`, `image`). Every form now emits the Twitter card tags, takes `titleSuffix` (appended to `<title>` only) and writes `og:locale` and `og:locale:alternate` in the Open Graph form (`pt_BR`). `RushImage` is responsive: it emits `srcset` and `sizes` on the media host, takes `layout`, `widths`, `priority` and `aspectRatio`, reads the size of a media without dimensions from the image itself and reserves an aspect box when it cannot. The sitemap no longer lists a collection list page in a locale whose listing is empty.
