---
'@rushcms/client': patch
---

Fail with an `invalid_response` error that names the configured and the final origin when a response was redirected to another origin (an `http://` API URL redirected to `https://`), instead of a bare 401 after the `Authorization` header is dropped.
