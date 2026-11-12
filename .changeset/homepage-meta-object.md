---
'@rushcms/client': patch
---

`Homepage.meta` is typed as an object, never null: it is an empty object when no SEO was ever set. The handler already behaved this way; only the contract said otherwise.
