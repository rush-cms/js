---
'create-rush-cms': minor
---

The generated `astro.config.ts` no longer falls back to `http://localhost:4321` when `SITE_URL` is empty: `site` and `security.allowedDomains` are set only when `SITE_URL` is, and a build without it fails. Set `SITE_URL` to your production URL before `npm run build`; `npm run dev` needs nothing. Existing projects keep their config: to get the new behaviour, drop the localhost fallback from `astro.config.ts`.
