---
'create-rush-cms': patch
---

The scaffold reads `SITE_URL` (default `http://localhost:4321`) to set `site` and `security.allowedDomains` in `astro.config.ts`; the two TODO comments are gone and `.env.example` lists `SITE_URL`.
