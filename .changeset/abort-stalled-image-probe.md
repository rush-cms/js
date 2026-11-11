---
'@rushcms/astro': patch
---

`RushImage` probes remote image sizes with its own request that is aborted when the probe deadline expires, reads only the bytes needed for the dimensions and cancels the body, instead of leaving a stalled request running.
