---
'create-rush-cms': patch
---

`--ssg` removes the empty `src/pages/[...locale]` directory that dropping the contact page leaves behind. The generic entry view no longer renders rich-text fields, which the template cannot know: it shows a note to edit `src/views/entry.astro`. The scaffold also pins the `@rushcms/client` and `@rushcms/astro` releases that fix `optional` and the untranslated homepage.
