---
'create-rush-cms': patch
---

Scaffolded list and taxonomy pages use `<Seo page>` with a site-name `titleSuffix`, list cards pass `sizes` and `aspectRatio` to `RushImage`, the entry cover loads with `priority`, and an empty list page is marked `noindex`, as the sitemap leaves it out.
