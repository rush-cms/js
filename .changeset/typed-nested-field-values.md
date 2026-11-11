---
'@rushcms/client': major
'@rushcms/astro': minor
---

Breaking for TypeScript users: nested field values are typed. The API contract now describes `Entry['data']`, homepage section values, site option group values, Block values and rich-text custom block values with named schemas instead of free objects, and the generated types follow. Runtime behaviour does not change.

Existing code that compiled against the free-object types can stop compiling:

- A field value is a `FieldValue` (string, number, boolean, string list, `RichText`, database items, repeater items or a Block value) instead of `unknown`; narrow it before use, and values you construct for typed fixtures must match.
- A repeater item requires a string `_id`, and repeaters nest at most one level (`NestedRepeaterItem`); items without `_id` no longer type-check.
- A database field value is an array of `ExpandedDatabaseItem` (`id`, `name`, `description`, `parent_id`), also for single-choice fields.
- Block values cannot contain block fields.
- Admin field widths are no longer served on public Block definitions.

New exported types: `FieldValue`, `FieldValues`, `BlockValue`, `BlockValues`, `RepeaterItem`, `NestedRepeaterItem`, `ExpandedDatabaseItem`. `@rushcms/astro` moves its `@rushcms/client` range to the new major, so sites typed against the old client types may need the same adjustments.
