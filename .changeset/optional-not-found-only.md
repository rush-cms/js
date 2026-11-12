---
'@rushcms/client': patch
---

`optional` resolves `undefined` only for the `not_found` error code, as documented. `moved` and `not_translated` 404s are rethrown instead of being swallowed, so callers can read their redirect and alternate params.
