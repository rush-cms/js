---
'create-rush-cms': patch
---

`--ssg` removes the empty `src/pages/[...locale]` directory that dropping the contact page leaves behind. The scaffold also pins the `@rushcms/client` and `@rushcms/astro` releases that fix `optional` and the untranslated homepage.
