export interface paths {
	'/api/v1/openapi.json': {
		parameters: {
			query?: never
			header?: never
			path?: never
			cookie?: never
		}
		/**
		 * This OpenAPI document as JSON
		 * @description Serves the embedded contract as JSON. Needs no token, may be cached and is readable from any origin
		 *     (`Access-Control-Allow-Origin: *`). A matching `If-None-Match` answers `304`.
		 */
		get: operations['getOpenAPI']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/site': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Public site settings
		 * @description Locales, default locale, timezone and the fallback flag of the site. Perspective-independent.
		 */
		get: operations['getSite']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/homepage': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Homepage in the requested locale
		 * @description Content rule: with the site flag on, the homepage of the first locale of the preference order that has one
		 *     (`fallback: true` when it is not L); with the flag off, only L's homepage, otherwise `404 not_translated`.
		 *     Sends `Content-Language` with the served locale in BCP 47.
		 */
		get: operations['getHomepage']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/collections': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Active collections
		 * @description Unpaginated. Ordered by creation time, oldest first. Names and slugs follow the structure rule.
		 */
		get: operations['listCollections']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/collections/{collection}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
			}
			cookie?: never
		}
		/** One active collection */
		get: operations['getCollection']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/collections/{collection}/entries': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
			}
			cookie?: never
		}
		/**
		 * Entries of a collection
		 * @description Paginated; `per_page` defaults to the collection's `items_per_page`. Content rule: each entry appears once,
		 *     in its served translation. Order: when the collection `is_reorderable`, `sort_order` ascending with nulls
		 *     last, then `published_at` descending, then entry id descending; otherwise `published_at` descending, then
		 *     entry id descending. The trailing id keeps pages stable. A page past the end answers an empty `data` with
		 *     the real `meta.total`.
		 */
		get: operations['listEntries']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/collections/{collection}/search': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
			}
			cookie?: never
		}
		/**
		 * Full-text search in a collection
		 * @description Paginated like `listEntries`. Each entry is matched against its served translation (content rule) with that
		 *     translation's text search configuration; title weighs more than excerpt, excerpt more than data. Order:
		 *     relevance descending, then `published_at` descending, then entry id descending. A missing or blank `q`
		 *     answers an empty page.
		 */
		get: operations['searchEntries']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/collections/{collection}/entries/{entry}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
				/**
				 * @description Entry slug, current or retired, in any locale (see the resolution steps).
				 * @example hello-world
				 */
				entry: components['parameters']['EntrySlug']
			}
			cookie?: never
		}
		/**
		 * One entry by localized slug
		 * @description Exactly one URL answers 200 per (entry, requested locale L); every other URL reaching the entry gets a coded
		 *     404 the site turns into a redirect.
		 *
		 *     1. The served translation T of an entry E: flag off, E's translation in L if it exists; flag on, E's first
		 *        translation in the preference order.
		 *     2. A current slug in L equal to `{entry}` finds E (T is then L's translation).
		 *     3. Else a current slug in another active locale finds E (several matches: the locale first in the preference
		 *        order, then the smallest entry id).
		 *     4. Else a retired slug (slug history) in any locale finds E; the most recent retirement wins. Current slugs
		 *        always win over history.
		 *     5. For E found in 3 or 4: T exists and `T.slug == {entry}` → 200; T exists with another slug → `404 moved`
		 *        with `params {locale, slug, collection_id, collection_slug}`; no T → `404 not_translated` with `params.available`.
		 *     6. Nothing found → `404 not_found` (`params.resource: entry`).
		 *     7. `{collection}` resolves through the collection slug of any locale, but a 200 also requires it to equal the
		 *        collection slug in L; otherwise the answer is `moved`, carrying both corrections at once.
		 *
		 *     Sends `Content-Language` with T's locale in BCP 47.
		 */
		get: operations['getEntry']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/tags': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Tags or categories
		 * @description Unpaginated. Ordered by name, then tag id. Names and slugs follow the structure rule. `entry_count` is the
		 *     number of entries `listTagEntries` lists for the same locale and perspective (`entry_count == meta.total`).
		 *     A `type` other than `tag` or `category` answers `400 bad_request`.
		 */
		get: operations['listTags']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/tags/{tag}/entries': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Tag or category slug in any locale of the preference order.
				 * @example news
				 */
				tag: components['parameters']['TagSlug']
			}
			cookie?: never
		}
		/**
		 * Entries carrying a tag or category
		 * @description Paginated; `per_page` defaults to 15. Entries of every active collection, content rule as in `listEntries`
		 *     (each carries its own `collection`). Order: `published_at` descending, then entry id descending.
		 *
		 *     Tag and category slugs are unique per type, so one slug can name both a tag and a category. Pass `type` to
		 *     resolve the slug within that taxonomy only; a slug absent from it answers `404 not_found`. Without `type`
		 *     the slug resolves across both taxonomies: the translation earliest in the locale preference order wins, and
		 *     on a tie a tag wins over a category. Always pass `type` when a slug may exist in both taxonomies.
		 *     A `type` other than `tag` or `category` answers `400 bad_request`.
		 */
		get: operations['listTagEntries']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/navigations': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Active navigations
		 * @description Unpaginated. Ordered by key. Items keep their stored order.
		 */
		get: operations['listNavigations']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/navigations/{key}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Navigation key.
				 * @example main
				 */
				key: components['parameters']['NavigationKey']
			}
			cookie?: never
		}
		/** One active navigation by key */
		get: operations['getNavigation']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/site-options': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Public site option groups
		 * @description Unpaginated. Non-private groups ordered by their sort order, then slug; private fields are never listed.
		 *     Values are live (no draft model). Name and description follow the structure rule; field values follow the
		 *     content rule (an untranslated localized field is `null`).
		 */
		get: operations['listSiteOptionGroups']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/site-options/{slug}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Site option group slug.
				 * @example contact
				 */
				slug: components['parameters']['SiteOptionGroupSlug']
			}
			cookie?: never
		}
		/**
		 * One public site option group
		 * @description A private or unknown group answers `404 not_found`.
		 */
		get: operations['getSiteOptionGroup']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/blocks': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Block definitions
		 * @description Unpaginated, locale-less. Ordered by slug.
		 */
		get: operations['listBlocks']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/blocks/{block}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Block slug.
				 * @example call-to-action
				 */
				block: components['parameters']['BlockSlug']
			}
			cookie?: never
		}
		/** One block definition by slug */
		get: operations['getBlock']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/databases': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Option databases
		 * @description Unpaginated, without items. Ordered by creation time, oldest first. Names and slugs carry no locale.
		 */
		get: operations['listDatabases']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/databases/{database}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description The database slug.
				 * @example services
				 */
				database: components['parameters']['DatabaseSlug']
			}
			cookie?: never
		}
		/**
		 * One database with its items
		 * @description `{database}` matches the database slug. Items form a flat list
		 *     ordered by `order`, then creation time; rebuild the tree with `parent_item_id`.
		 */
		get: operations['getDatabase']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/link-pages': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Active link pages
		 * @description Unpaginated, locale-less. Ordered by slug.
		 */
		get: operations['listLinkPages']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/link-pages/{linkpage}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Link page slug.
				 * @example links
				 */
				linkpage: components['parameters']['LinkPageSlug']
			}
			cookie?: never
		}
		/** One active link page by slug */
		get: operations['getLinkPage']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/forms': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		/**
		 * Active form schemas
		 * @description Unpaginated. Ordered by key. Labels follow the structure rule.
		 */
		get: operations['listForms']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/forms/{key}': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Form key (lowercase letters, digits and single hyphens, at most 255 characters).
				 * @example contact
				 */
				key: components['parameters']['FormKey']
			}
			cookie?: never
		}
		/** One active form schema by key */
		get: operations['getForm']
		put?: never
		post?: never
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
	'/api/v1/{site_id}/forms/{key}/submit': {
		parameters: {
			query?: never
			header?: never
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Form key (lowercase letters, digits and single hyphens, at most 255 characters).
				 * @example contact
				 */
				key: components['parameters']['FormKey']
			}
			cookie?: never
		}
		get?: never
		put?: never
		/**
		 * Submit a form from the site's server
		 * @description Sent by the site's server on behalf of a visitor. `X-Rush-Client-IP` carries the visitor IP used for limits
		 *     and stored with the submission; without a valid single IP literal the connection IP is used. Limits: 5 per
		 *     minute per site, form and visitor IP, and 60 per minute per site; every attempt counts. When the site enables
		 *     captcha (Cloudflare Turnstile) every form requires a token, read from the body field `cf-turnstile-response`
		 *     or the `X-Captcha-Token` header, and verified with the visitor IP. A filled honeypot field
		 *     (`Form.honeypot_field`) is discarded silently and answers exactly like a real submission. Unknown keys are
		 *     ignored. Body limit 1 MiB. Preview tokens and the draft perspective cannot submit.
		 */
		post: operations['submitForm']
		delete?: never
		options?: never
		head?: never
		patch?: never
		trace?: never
	}
}
export type webhooks = Record<string, never>
export interface components {
	schemas: {
		/**
		 * @description A ULID (26 characters, Crockford base32).
		 * @example 01JCNPZX45HY43KWJRP1XPA7Z3
		 */
		Ulid: string
		/**
		 * @description A locale code as stored by the site (`en`, `pt_BR`).
		 * @example pt_BR
		 */
		LocaleCode: string
		/**
		 * Format: date-time
		 * @description RFC 3339, UTC.
		 * @example 2026-11-05T12:00:00Z
		 */
		Timestamp: string
		/** @enum {string} */
		Perspective: 'published' | 'draft'
		/** @enum {string} */
		TagType: 'tag' | 'category'
		/** @description Any JSON value, including null. */
		JsonValue: unknown
		/** @description A free-form JSON object. */
		FreeObject: {
			[key: string]: unknown
		}
		Site: {
			id: components['schemas']['Ulid']
			name: string
			/** @description The site's primary domain, if set. */
			domain: string | null
			default_locale: components['schemas']['LocaleCode']
			/** @description Active locales, in the site's configured order. */
			locales: components['schemas']['LocaleCode'][]
			/**
			 * @description IANA timezone; `UTC` when unset.
			 * @example America/Sao_Paulo
			 */
			timezone: string
			/** @description Whether untranslated content is served from the preference order (`serve_untranslated_fallback`). */
			fallback: boolean
		}
		CollectionRef: {
			id: components['schemas']['Ulid']
			/** @description Collection slug in the requested locale (structure rule). */
			slug: string
		}
		TranslationRef: {
			/** @description Entry slug in that locale. */
			slug: string
			/** @description Collection slug in that locale. */
			collection_slug: string
		}
		Author: {
			id: components['schemas']['Ulid']
			name: string
		}
		/** @description A tag or category attached to an entry; name and slug follow the structure rule. */
		TagRef: {
			id: components['schemas']['Ulid']
			type: components['schemas']['TagType']
			name: string
			slug: string
		}
		Tag: {
			id: components['schemas']['Ulid']
			type: components['schemas']['TagType']
			name: string
			slug: string
			/** @description Entries `listTagEntries` lists for the same locale and perspective. */
			entry_count: number
		}
		/**
		 * @description A media file referenced by content. Every key is optional: `url` is absent when the stored URL is unsafe, and
		 *     the descriptor fields are absent when the file is not a media item of this site.
		 */
		Media: {
			/** @description `{MEDIA_BASE_URL}/{site_id}/{media_id}/master`, extensionless and stable. */
			url?: string
			media_id?: components['schemas']['Ulid']
			mime_type?: string
			/**
			 * Format: int64
			 * @description Bytes of the master file.
			 */
			size?: number
			width?: number
			height?: number
			alt?: string
			title?: string
			variants?: components['schemas']['MediaVariants']
			updated_at?: components['schemas']['Timestamp']
		}
		/**
		 * @description Derived files keyed by variant name; `thumb` is a 300px WebP. A stored JSON null is served as an empty
		 *     object.
		 */
		MediaVariants: {
			thumb?: components['schemas']['MediaVariant']
		} & {
			[key: string]: components['schemas']['MediaVariant']
		}
		MediaVariant: {
			key: string
			url: string
		}
		/** @description Media referenced by the content, keyed by media id. */
		MediaMap: {
			[key: string]: components['schemas']['Media']
		}
		Entry: {
			id: components['schemas']['Ulid']
			/** @description Slug of the served translation. */
			slug: string
			title: string
			/** @description Absent when empty. */
			excerpt?: string
			featured_image?: components['schemas']['Media']
			/**
			 * @description Always `published` in the published perspective; the working state in the draft perspective.
			 * @enum {string}
			 */
			status: 'published' | 'draft' | 'changed'
			/** @description Manual position in reorderable collections; absent when unset. */
			sort_order?: number
			author?: components['schemas']['Author']
			/** @description Ordered by name, then id. */
			tags: components['schemas']['TagRef'][]
			/** @description Ordered by name, then id. */
			categories: components['schemas']['TagRef'][]
			data: components['schemas']['EntryData']
			media: components['schemas']['MediaMap']
			locale: components['schemas']['LocaleCode']
			/** @description True when the served locale differs from the requested locale. */
			fallback: boolean
			collection: components['schemas']['CollectionRef']
			/**
			 * @description Every translation of the entry that exists in the request perspective, in the site's active locales,
			 *     including the served one, keyed by locale code.
			 */
			translations: {
				[key: string]: components['schemas']['TranslationRef']
			}
			published_at: components['schemas']['Timestamp']
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		/** @description The entry's field values (see `FieldValues`). */
		EntryData: components['schemas']['FieldValues']
		/**
		 * @description Field values keyed by field name; each value takes the form its field type gives it (see `FieldValue`). In
		 *     entries, shared fields are merged with the served translation's localized fields. Only fields the current
		 *     blueprint declares are returned, at every depth (top level, repeater items, block values, rich-text custom
		 *     blocks); values under keys it no longer declares are omitted. A collection without a declared field layout
		 *     returns its top-level values as stored. Unsafe URLs are blanked; text is returned verbatim. Admin presentation
		 *     settings of the fields (such as widths) are never part of the values.
		 */
		FieldValues: {
			[key: string]: components['schemas']['FieldValue']
		}
		/**
		 * @description The value of a top-level field of an entry or a site option group: a `NonBlockFieldValue`, or a `BlockValue`
		 *     for block fields.
		 */
		FieldValue:
			components['schemas']['NonBlockFieldValue'] | components['schemas']['BlockValue']
		/**
		 * @description The value of a top-level field of any type except block: a `LeafFieldValue`, or a `RepeaterValue` for
		 *     repeater fields. Blocks cannot contain block fields, so every value of a block's own fields takes this form.
		 */
		NonBlockFieldValue:
			components['schemas']['LeafFieldValue'] | components['schemas']['RepeaterValue']
		/**
		 * @description A value that may appear at every depth. Text, textarea, select, color and markdown fields hold a string; image
		 *     and file fields a media URL (entries and site option groups also carry a `media` map keyed by media id; homepage values hold only the URL); checkbox, list, gallery and category fields a
		 *     `StringListValue`; rich-text fields a `RichText` document; database fields a `DatabaseFieldValue`. `null` when
		 *     unfilled, and for a block field whose block no longer exists.
		 */
		LeafFieldValue:
			| (string | null)
			| number
			| boolean
			| components['schemas']['StringListValue']
			| components['schemas']['RichText']
			| components['schemas']['DatabaseFieldValue']
		/** @description Selected options, list rows, gallery media URLs or category ids. */
		StringListValue: string[]
		/** @description The value of a block field; `values` follow the block's fields. */
		BlockValue: {
			/** @description Block slug. */
			block: string
			values: components['schemas']['BlockValues']
		}
		/**
		 * @description The values of a block's fields keyed by field name, with the same rules as `FieldValues`. Blocks cannot
		 *     contain block fields, so each value is a `NonBlockFieldValue`.
		 */
		BlockValues: {
			[key: string]: components['schemas']['NonBlockFieldValue']
		}
		/**
		 * @description The selected items of a database field, at any depth, resolved in the requested locale and in stored order;
		 *     unknown or deleted items are left out. Always an array, also for single-choice fields (at most one item).
		 */
		DatabaseFieldValue: components['schemas']['ExpandedDatabaseItem'][]
		ExpandedDatabaseItem: {
			id: components['schemas']['Ulid']
			/** @description Name in the requested locale (preference order). */
			name: string
			/** @description Description in the requested locale; empty when unset. */
			description: string
			/** @description ULID of the parent item; null for a root item. */
			parent_id: string | null
		}
		/** @description Stable item id assigned by the server on every write; use it as the item key. */
		RepeaterItemId: string
		/** @description The items of a top-level repeater field, in stored order. */
		RepeaterValue: components['schemas']['RepeaterItem'][]
		/**
		 * @description One item of a top-level repeater: `_id` plus the repeater's declared sub-fields. A sub-field holds a
		 *     `RepeaterItemValue`, exactly as a top-level field of its type.
		 */
		RepeaterItem: {
			_id: components['schemas']['RepeaterItemId']
		} & {
			[key: string]: components['schemas']['RepeaterItemValue']
		}
		/**
		 * @description The value of a sub-field of a top-level repeater item: any `LeafFieldValue` or a `NestedRepeaterValue` (a
		 *     repeater inside a repeater). Block fields are not allowed inside repeaters.
		 */
		RepeaterItemValue:
			components['schemas']['LeafFieldValue'] | components['schemas']['NestedRepeaterValue']
		/** @description The items of a repeater nested in a repeater item (the deepest level allowed), in stored order. */
		NestedRepeaterValue: components['schemas']['NestedRepeaterItem'][]
		/** @description One item of a nested repeater; its sub-fields hold `LeafFieldValue`s (no further repeaters). */
		NestedRepeaterItem: {
			_id: components['schemas']['RepeaterItemId']
		} & {
			[key: string]: components['schemas']['LeafFieldValue']
		}
		/** @description The served translation of an entry, enough to build its URL. */
		EntrySummary: {
			id: components['schemas']['Ulid']
			slug: string
			locale: components['schemas']['LocaleCode']
			fallback: boolean
			collection: components['schemas']['CollectionRef']
		}
		PaginationMeta: {
			/** Format: int64 */
			total: number
			per_page: number
			current_page: number
			last_page: number
		}
		Homepage: {
			id: components['schemas']['Ulid']
			locale: components['schemas']['LocaleCode']
			/** @description True when the served locale differs from the requested locale. */
			fallback: boolean
			/**
			 * @description Locales that have a homepage in the request perspective, among the site's active locales, in the site's
			 *     configured order, including the served one.
			 */
			translations: components['schemas']['LocaleCode'][]
			/** @description Sections in display order. */
			content: components['schemas']['HomepageSection'][]
			meta: components['schemas']['HomepageMeta']
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		/**
		 * @description A block instance. `values` follow the block's fields like `EntryData`: only declared fields at every depth,
		 *     database values expanded in the requested locale, unsafe URLs blanked. Values of a block that no longer
		 *     exists are returned as stored, with unsafe URLs blanked.
		 */
		HomepageSection: {
			/** @description Section id chosen by the editor. */
			id?: string
			/** @description Block slug; null when the block no longer exists. */
			block: string | null
			values: components['schemas']['BlockValues']
		}
		/** @description SEO of the served locale; an empty object when never set. */
		HomepageMeta: {
			title?: string
			description?: string
			og_image?: string
		}
		Collection: {
			id: components['schemas']['Ulid']
			slug: string
			name: string
			/** @description When true, entry lists follow `sort_order`. */
			is_reorderable: boolean
			/** @description Default `per_page` of the collection's entry lists. */
			items_per_page: number
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		Navigation: {
			id: components['schemas']['Ulid']
			name: string
			key: string
			items: components['schemas']['NavigationItem'][]
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		/**
		 * @description An entry or collection item whose target cannot be served (unpublished, untranslated under the content rule,
		 *     inactive collection) is dropped, unless it has surviving children; it then stays without `target`.
		 */
		NavigationItem: {
			/** @description Structure rule. */
			label: string
			/** @enum {string} */
			type: 'url' | 'entry' | 'collection'
			target?: components['schemas']['NavigationTarget']
			/** @description The HTML `target` of the link (for example `_blank`). */
			link_target?: string
			nofollow?: boolean
			noreferrer?: boolean
			class?: string
			attributes?: components['schemas']['NavigationAttribute'][]
			children: components['schemas']['NavigationItem'][]
		}
		/** @description Exactly one key, matching the item `type`. */
		NavigationTarget: {
			/** @description Empty when the stored URL is unsafe. */
			url?: string
			entry?: components['schemas']['EntrySummary']
			collection?: components['schemas']['CollectionRef']
		}
		/** @description An extra HTML attribute; names are allow-listed (`data-*`, `aria-*`, `title`, `rel`, `id`, `role`, `lang`, `hreflang`, `download`, `type`). */
		NavigationAttribute: {
			name: string
			value?: components['schemas']['JsonValue']
		}
		SiteOptionGroup: {
			slug: string
			name: string
			/** @description Empty when unset. */
			description: string
			/** @description One key per public field; `null` when unfilled or untranslated under the content rule. */
			values: components['schemas']['FieldValues']
			media: components['schemas']['MediaMap']
			updated_at: components['schemas']['Timestamp']
		}
		/**
		 * @description `fields` is the block blueprint as stored (field groups, or `{main, sidebar}`) without admin presentation
		 *     settings: field widths (`data.config.width`) are left out at every depth. `locations` says where the block may
		 *     be used, as stored, and is absent when unset.
		 */
		Block: {
			id: components['schemas']['Ulid']
			name: string
			slug: string
			description?: string
			fields: components['schemas']['JsonValue']
			locations?: components['schemas']['JsonValue']
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		Database: {
			id: components['schemas']['Ulid']
			name: string
			slug: string
			is_required: boolean
			is_multiple: boolean
		}
		DatabaseItem: {
			id: components['schemas']['Ulid']
			name: string
			/** @description Absent when empty. */
			description?: string
			order: number
			parent_item_id?: components['schemas']['Ulid']
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		DatabaseDetail: {
			database: components['schemas']['Database']
			items: components['schemas']['DatabaseItem'][]
		}
		LinkPage: {
			id: components['schemas']['Ulid']
			title: string
			slug: string
			subtitle?: string
			avatar_url?: string
			links: components['schemas']['LinkPageLink'][]
			theme?: components['schemas']['LinkPageTheme']
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		/** @description A link as stored by the admin; URLs are sanitized. */
		LinkPageLink: {
			title?: string
			url?: string
			icon?: string | null
			/** @enum {string} */
			display_mode?: 'icon' | 'icon_text' | 'text'
		} & {
			[key: string]: unknown
		}
		/** @description Theme as stored by the admin; URLs are sanitized. A stored JSON null is served as an empty object. */
		LinkPageTheme: {
			background_color?: string | null
			button_color?: string | null
			text_color?: string | null
			social_links?: components['schemas']['LinkPageSocialLink'][]
		} & {
			[key: string]: unknown
		}
		LinkPageSocialLink: {
			platform?: string
			url?: string
		} & {
			[key: string]: unknown
		}
		Form: {
			id: components['schemas']['Ulid']
			key: string
			name: string
			fields: components['schemas']['FormField'][]
			/** @description Name of the hidden input that must stay empty. */
			honeypot_field?: string
			captcha?: components['schemas']['FormCaptcha']
			created_at: components['schemas']['Timestamp']
			updated_at: components['schemas']['Timestamp']
		}
		/** @description Present when the site requires a captcha on its forms. */
		FormCaptcha: {
			/** @enum {string} */
			provider: 'turnstile'
			site_key: string
		}
		FormField: {
			/** @description Body key of the field on submit. */
			handle: string
			/** @enum {string} */
			type:
				| 'text'
				| 'email'
				| 'textarea'
				| 'number'
				| 'tel'
				| 'url'
				| 'date'
				| 'select'
				| 'radio'
				| 'checkbox'
				| 'hidden'
			label: string
			placeholder?: string
			help_text?: string
			/** @description Absent when false. */
			required?: boolean
			min_length?: number
			max_length?: number
			min?: number
			max?: number
			pattern?: string
			/** @description For `select`, `radio` and `checkbox`; absent when empty. */
			options?: components['schemas']['FormFieldOption'][]
		}
		FormFieldOption: {
			value: string
			label: string
		}
		/**
		 * @description Field values keyed by `FormField.handle`; a `checkbox` takes several values (a JSON array, or the key
		 *     repeated). JSON scalars are read as strings. May carry `cf-turnstile-response` and the honeypot field.
		 */
		FormSubmission: {
			[key: string]: unknown
		}
		FormSubmitResult: {
			/** @enum {boolean} */
			received: true
		}
		Error: {
			/** @description English message for logs; never shown to visitors. */
			error: string
			code: components['schemas']['ErrorCode']
			params?: components['schemas']['ErrorParams']
			/** @description Present with `validation_failed`. */
			errors?: components['schemas']['FieldError'][]
		}
		/** @enum {string} */
		ErrorCode:
			| 'bad_request'
			| 'locale_not_served'
			| 'invalid_perspective'
			| 'unauthorized'
			| 'token_expired'
			| 'forbidden'
			| 'site_suspended'
			| 'preview_requires_preview_token'
			| 'preview_cannot_submit'
			| 'not_found'
			| 'not_translated'
			| 'moved'
			| 'method_not_allowed'
			| 'payload_too_large'
			| 'validation_failed'
			| 'captcha_failed'
			| 'rate_limited'
			| 'internal_error'
			| 'captcha_unavailable'
		/** @description Parameters of the error, by code. */
		ErrorParams: {
			/**
			 * @description `not_found`: what is missing.
			 * @enum {string}
			 */
			resource?:
				| 'homepage'
				| 'collection'
				| 'entry'
				| 'tag'
				| 'navigation'
				| 'site_option_group'
				| 'block'
				| 'database'
				| 'link_page'
				| 'form'
				| 'route'
			/** @description `locale_not_served`: the site's locales. `not_translated`: the locales the resource exists in. */
			available?: components['schemas']['LocaleCode'][]
			locale?: components['schemas']['LocaleCode']
			/** @description `moved`: the entry slug to redirect to. */
			slug?: string
			/** @description `moved`: the id of the collection the entry belongs to. */
			collection_id?: string
			/** @description `moved`: the collection slug to redirect to. */
			collection_slug?: string
			/** @description `rate_limited`: seconds to wait. */
			retry_after?: number
		}
		FieldError: {
			/** @description The field handle. */
			field: string
			code: components['schemas']['FieldErrorCode']
			params?: components['schemas']['FieldErrorParams']
		}
		/**
		 * @description `required`: empty required field. `invalid_option`: value outside the options (`params.value`).
		 *     `invalid_email`, `invalid_url`, `invalid_number`: wrong format for the field type. `too_small` / `too_large`:
		 *     number below `params.min` / above `params.max`. `too_short` / `too_long`: fewer than `params.min` / more than
		 *     `params.max` characters. `invalid_format`: value does not match the field `pattern`.
		 * @enum {string}
		 */
		FieldErrorCode:
			| 'required'
			| 'invalid_option'
			| 'invalid_email'
			| 'invalid_url'
			| 'invalid_number'
			| 'too_small'
			| 'too_large'
			| 'too_short'
			| 'too_long'
			| 'invalid_format'
		FieldErrorParams: {
			min?: number
			max?: number
			value?: string
		}
		/**
		 * @description A TipTap JSON document. Nodes follow TipTap StarterKit plus `codeBlock` (`attrs.language`), `image`
		 *     (`attrs.src`, `attrs.alt`, `attrs.align`, `attrs.mediaId`, join with `media` by `mediaId`), `gallery`
		 *     (`attrs.images`, `attrs.layout`, `attrs.lightbox`), the `link` mark (`attrs.href`, empty when unsafe) and
		 *     `customBlock` (see `CustomBlockNode`).
		 * @example {
		 *       "type": "doc",
		 *       "content": [
		 *         {
		 *           "type": "heading",
		 *           "attrs": {
		 *             "level": 2
		 *           },
		 *           "content": [
		 *             {
		 *               "type": "text",
		 *               "text": "Hello"
		 *             }
		 *           ]
		 *         },
		 *         {
		 *           "type": "customBlock",
		 *           "attrs": {
		 *             "block": "call-to-action",
		 *             "values": {
		 *               "label": "Subscribe"
		 *             }
		 *           }
		 *         }
		 *       ]
		 *     }
		 */
		RichText: {
			/** @enum {string} */
			type: 'doc'
			content?: components['schemas']['RichTextContent'][]
		}
		/** @description A rich-text node; `customBlock` nodes take the `CustomBlockNode` shape. */
		RichTextContent:
			components['schemas']['CustomBlockNode'] | components['schemas']['RichTextNode']
		RichTextNode: {
			/**
			 * @description Any TipTap node type except `customBlock`, which takes the `CustomBlockNode` shape.
			 * @example paragraph
			 */
			type: string
			attrs?: components['schemas']['FreeObject']
			content?: components['schemas']['RichTextContent'][]
			marks?: components['schemas']['RichTextMark'][]
			text?: string
		}
		RichTextMark: {
			/** @example link */
			type: string
			attrs?: components['schemas']['FreeObject']
		}
		/** @description An inline use of a block inside rich text. */
		CustomBlockNode: {
			/** @enum {string} */
			type: 'customBlock'
			attrs: components['schemas']['CustomBlockAttrs']
		}
		CustomBlockAttrs: {
			/** @description Block slug. */
			block: string
			values: components['schemas']['BlockValues']
		}
		SiteEnvelope: {
			data: components['schemas']['Site']
		}
		HomepageEnvelope: {
			data: components['schemas']['Homepage']
		}
		CollectionListEnvelope: {
			data: components['schemas']['Collection'][]
		}
		CollectionEnvelope: {
			data: components['schemas']['Collection']
		}
		EntryPage: {
			data: components['schemas']['Entry'][]
			meta: components['schemas']['PaginationMeta']
		}
		EntryEnvelope: {
			data: components['schemas']['Entry']
		}
		TagListEnvelope: {
			data: components['schemas']['Tag'][]
		}
		NavigationListEnvelope: {
			data: components['schemas']['Navigation'][]
		}
		NavigationEnvelope: {
			data: components['schemas']['Navigation']
		}
		SiteOptionGroupListEnvelope: {
			data: components['schemas']['SiteOptionGroup'][]
		}
		SiteOptionGroupEnvelope: {
			data: components['schemas']['SiteOptionGroup']
		}
		BlockListEnvelope: {
			data: components['schemas']['Block'][]
		}
		BlockEnvelope: {
			data: components['schemas']['Block']
		}
		DatabaseListEnvelope: {
			data: components['schemas']['Database'][]
		}
		DatabaseDetailEnvelope: {
			data: components['schemas']['DatabaseDetail']
		}
		LinkPageListEnvelope: {
			data: components['schemas']['LinkPage'][]
		}
		LinkPageEnvelope: {
			data: components['schemas']['LinkPage']
		}
		FormListEnvelope: {
			data: components['schemas']['Form'][]
		}
		FormEnvelope: {
			data: components['schemas']['Form']
		}
		FormSubmitEnvelope: {
			data: components['schemas']['FormSubmitResult']
		}
	}
	responses: {
		/** @description The OpenAPI document. */
		OpenAPIDocument: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "openapi": "3.0.3",
				 *       "info": {
				 *         "title": "Rush CMS public API",
				 *         "version": "1.0.0"
				 *       },
				 *       "paths": {}
				 *     }
				 */
				'application/json': {
					[key: string]: unknown
				}
			}
		}
		/** @description The site. */
		SiteOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JCM9S346Q3D25VT4F5V37E3S",
				 *         "name": "Example Studio",
				 *         "domain": "www.example.com",
				 *         "default_locale": "en",
				 *         "locales": [
				 *           "en",
				 *           "pt_BR",
				 *           "es"
				 *         ],
				 *         "timezone": "America/Sao_Paulo",
				 *         "fallback": true
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['SiteEnvelope']
			}
		}
		/** @description The homepage in its served locale. */
		HomepageOk: {
			headers: {
				'Content-Language': components['headers']['ContentLanguage']
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JCH3BV4H15G5E4G7X0NTH82F",
				 *         "locale": "pt_BR",
				 *         "fallback": false,
				 *         "translations": [
				 *           "en",
				 *           "pt_BR"
				 *         ],
				 *         "content": [
				 *           {
				 *             "id": "hero-1",
				 *             "block": "hero",
				 *             "values": {
				 *               "heading": "Bem-vindo",
				 *               "image": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master"
				 *             }
				 *           },
				 *           {
				 *             "id": "cta-1",
				 *             "block": "call-to-action",
				 *             "values": {
				 *               "label": "Assine"
				 *             }
				 *           }
				 *         ],
				 *         "meta": {
				 *           "title": "Example Studio",
				 *           "description": "Estúdio de design.",
				 *           "og_image": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master"
				 *         },
				 *         "created_at": "2026-10-01T12:00:00Z",
				 *         "updated_at": "2026-11-02T09:30:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['HomepageEnvelope']
			}
		}
		/** @description Active collections. */
		CollectionListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *           "slug": "artigos",
				 *           "name": "Artigos",
				 *           "is_reorderable": false,
				 *           "items_per_page": 12,
				 *           "created_at": "2026-09-01T10:00:00Z",
				 *           "updated_at": "2026-10-20T15:00:00Z"
				 *         },
				 *         {
				 *           "id": "01JCQKFBF5KZNWJ47TAN9ZT24M",
				 *           "slug": "paginas",
				 *           "name": "Páginas",
				 *           "is_reorderable": true,
				 *           "items_per_page": 50,
				 *           "created_at": "2026-09-01T10:05:00Z",
				 *           "updated_at": "2026-09-01T10:05:00Z"
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['CollectionListEnvelope']
			}
		}
		/** @description The collection. */
		CollectionOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *         "slug": "blog",
				 *         "name": "Blog",
				 *         "is_reorderable": false,
				 *         "items_per_page": 12,
				 *         "created_at": "2026-09-01T10:00:00Z",
				 *         "updated_at": "2026-10-20T15:00:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['CollectionEnvelope']
			}
		}
		/** @description One page of entries. */
		EntryPageOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JCDJ8FSSZ5AWSH8VHTPRE95B",
				 *           "slug": "only-english",
				 *           "title": "Only English",
				 *           "status": "published",
				 *           "tags": [],
				 *           "categories": [],
				 *           "data": {
				 *             "body": {
				 *               "type": "doc",
				 *               "content": [
				 *                 {
				 *                   "type": "paragraph",
				 *                   "content": [
				 *                     {
				 *                       "type": "text",
				 *                       "text": "Written in English only."
				 *                     }
				 *                   ]
				 *                 }
				 *               ]
				 *             }
				 *           },
				 *           "media": {},
				 *           "locale": "en",
				 *           "fallback": true,
				 *           "collection": {
				 *             "id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *             "slug": "articulos"
				 *           },
				 *           "translations": {
				 *             "en": {
				 *               "slug": "only-english",
				 *               "collection_slug": "blog"
				 *             }
				 *           },
				 *           "published_at": "2026-10-28T08:00:00Z",
				 *           "created_at": "2026-10-27T17:12:00Z",
				 *           "updated_at": "2026-10-28T08:00:00Z"
				 *         }
				 *       ],
				 *       "meta": {
				 *         "total": 1,
				 *         "per_page": 12,
				 *         "current_page": 1,
				 *         "last_page": 1
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['EntryPage']
			}
		}
		/** @description The entry in its served translation. */
		EntryOk: {
			headers: {
				'Content-Language': components['headers']['ContentLanguage']
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JCNPZX45HY43KWJRP1XPA7Z3",
				 *         "slug": "ola-mundo",
				 *         "title": "Olá mundo",
				 *         "excerpt": "O primeiro artigo.",
				 *         "featured_image": {
				 *           "url": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master",
				 *           "media_id": "01JC9EE0ZBGJ09TQM83XSSSS6Y",
				 *           "mime_type": "image/webp",
				 *           "size": 182044,
				 *           "width": 1600,
				 *           "height": 900,
				 *           "alt": "A sunrise over the bay",
				 *           "variants": {
				 *             "thumb": {
				 *               "key": "01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/thumb",
				 *               "url": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/thumb"
				 *             }
				 *           },
				 *           "updated_at": "2026-10-02T11:00:00Z"
				 *         },
				 *         "status": "published",
				 *         "author": {
				 *           "id": "01JCS3C4DWA7N36096Q14DR9GP",
				 *           "name": "Ana Souza"
				 *         },
				 *         "tags": [
				 *           {
				 *             "id": "01JCQY77ZXYYK596NGYA1DQ91K",
				 *             "type": "tag",
				 *             "name": "Notícias",
				 *             "slug": "noticias"
				 *           }
				 *         ],
				 *         "categories": [
				 *           {
				 *             "id": "01JC5GQAPENECFSECZP11HYGCP",
				 *             "type": "category",
				 *             "name": "Empresa",
				 *             "slug": "empresa"
				 *           }
				 *         ],
				 *         "data": {
				 *           "body": {
				 *             "type": "doc",
				 *             "content": [
				 *               {
				 *                 "type": "paragraph",
				 *                 "content": [
				 *                   {
				 *                     "type": "text",
				 *                     "text": "Olá, "
				 *                   },
				 *                   {
				 *                     "type": "text",
				 *                     "text": "mundo",
				 *                     "marks": [
				 *                       {
				 *                         "type": "link",
				 *                         "attrs": {
				 *                           "href": "https://example.com"
				 *                         }
				 *                       }
				 *                     ]
				 *                   }
				 *                 ]
				 *               },
				 *               {
				 *                 "type": "customBlock",
				 *                 "attrs": {
				 *                   "block": "call-to-action",
				 *                   "values": {
				 *                     "label": "Assine"
				 *                   }
				 *                 }
				 *               }
				 *             ]
				 *           },
				 *           "seo_title": "Olá mundo | Example Studio"
				 *         },
				 *         "media": {
				 *           "01JC9EE0ZBGJ09TQM83XSSSS6Y": {
				 *             "url": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master",
				 *             "media_id": "01JC9EE0ZBGJ09TQM83XSSSS6Y",
				 *             "mime_type": "image/webp",
				 *             "size": 182044,
				 *             "width": 1600,
				 *             "height": 900,
				 *             "alt": "A sunrise over the bay",
				 *             "updated_at": "2026-10-02T11:00:00Z"
				 *           }
				 *         },
				 *         "locale": "pt_BR",
				 *         "fallback": false,
				 *         "collection": {
				 *           "id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *           "slug": "artigos"
				 *         },
				 *         "translations": {
				 *           "en": {
				 *             "slug": "hello-world",
				 *             "collection_slug": "blog"
				 *           },
				 *           "pt_BR": {
				 *             "slug": "ola-mundo",
				 *             "collection_slug": "artigos"
				 *           },
				 *           "es": {
				 *             "slug": "hola-mundo",
				 *             "collection_slug": "articulos"
				 *           }
				 *         },
				 *         "published_at": "2026-10-05T09:00:00Z",
				 *         "created_at": "2026-10-01T14:22:00Z",
				 *         "updated_at": "2026-11-01T18:40:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['EntryEnvelope']
			}
		}
		/** @description Tags or categories with their entry counts. */
		TagListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JCQY77ZXYYK596NGYA1DQ91K",
				 *           "type": "tag",
				 *           "name": "Notícias",
				 *           "slug": "noticias",
				 *           "entry_count": 2
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['TagListEnvelope']
			}
		}
		/** @description Active navigations. */
		NavigationListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JCWPQ5E6EYCNDY0YP57RCYBV",
				 *           "name": "Main menu",
				 *           "key": "main",
				 *           "items": [
				 *             {
				 *               "label": "Blog",
				 *               "type": "collection",
				 *               "target": {
				 *                 "collection": {
				 *                   "id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *                   "slug": "blog"
				 *                 }
				 *               },
				 *               "children": []
				 *             }
				 *           ],
				 *           "created_at": "2026-09-02T10:00:00Z",
				 *           "updated_at": "2026-10-30T12:00:00Z"
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['NavigationListEnvelope']
			}
		}
		/** @description The navigation. */
		NavigationOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JCWPQ5E6EYCNDY0YP57RCYBV",
				 *         "name": "Menu principal",
				 *         "key": "main",
				 *         "items": [
				 *           {
				 *             "label": "Olá mundo",
				 *             "type": "entry",
				 *             "target": {
				 *               "entry": {
				 *                 "id": "01JCNPZX45HY43KWJRP1XPA7Z3",
				 *                 "slug": "ola-mundo",
				 *                 "locale": "pt_BR",
				 *                 "fallback": false,
				 *                 "collection": {
				 *                   "id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *                   "slug": "artigos"
				 *                 }
				 *               }
				 *             },
				 *             "children": []
				 *           },
				 *           {
				 *             "label": "Contato",
				 *             "type": "url",
				 *             "target": {
				 *               "url": "https://example.com/contato"
				 *             },
				 *             "link_target": "_blank",
				 *             "noreferrer": true,
				 *             "attributes": [
				 *               {
				 *                 "name": "data-track",
				 *                 "value": "contact"
				 *               }
				 *             ],
				 *             "children": []
				 *           }
				 *         ],
				 *         "created_at": "2026-09-02T10:00:00Z",
				 *         "updated_at": "2026-10-30T12:00:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['NavigationEnvelope']
			}
		}
		/** @description Public site option groups. */
		SiteOptionGroupListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "slug": "contact",
				 *           "name": "Contato",
				 *           "description": "",
				 *           "values": {
				 *             "phone": "+55 11 5555-0000",
				 *             "tagline": null
				 *           },
				 *           "media": {},
				 *           "updated_at": "2026-10-11T09:00:00Z"
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['SiteOptionGroupListEnvelope']
			}
		}
		/** @description The site option group. */
		SiteOptionGroupOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "slug": "branding",
				 *         "name": "Marca",
				 *         "description": "Logotipo e slogan.",
				 *         "values": {
				 *           "tagline": "Design que conversa",
				 *           "logo": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master"
				 *         },
				 *         "media": {
				 *           "01JC9EE0ZBGJ09TQM83XSSSS6Y": {
				 *             "url": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master",
				 *             "media_id": "01JC9EE0ZBGJ09TQM83XSSSS6Y",
				 *             "mime_type": "image/svg+xml",
				 *             "size": 4210
				 *           }
				 *         },
				 *         "updated_at": "2026-10-11T09:00:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['SiteOptionGroupEnvelope']
			}
		}
		/** @description Block definitions. */
		BlockListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JCN5SXS5AA819X9YP981068V",
				 *           "name": "Call to action",
				 *           "slug": "call-to-action",
				 *           "fields": [
				 *             {
				 *               "name": "Content",
				 *               "fields": [
				 *                 {
				 *                   "type": "text",
				 *                   "data": {
				 *                     "config": {
				 *                       "name": "label"
				 *                     }
				 *                   }
				 *                 }
				 *               ]
				 *             }
				 *           ],
				 *           "created_at": "2026-09-05T10:00:00Z",
				 *           "updated_at": "2026-09-05T10:00:00Z"
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['BlockListEnvelope']
			}
		}
		/** @description The block definition. */
		BlockOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JCN5SXS5AA819X9YP981068V",
				 *         "name": "Call to action",
				 *         "slug": "call-to-action",
				 *         "description": "A button with a label.",
				 *         "fields": [
				 *           {
				 *             "name": "Content",
				 *             "fields": [
				 *               {
				 *                 "type": "text",
				 *                 "data": {
				 *                   "config": {
				 *                     "name": "label"
				 *                   }
				 *                 }
				 *               }
				 *             ]
				 *           }
				 *         ],
				 *         "locations": [
				 *           "homepage",
				 *           "entries"
				 *         ],
				 *         "created_at": "2026-09-05T10:00:00Z",
				 *         "updated_at": "2026-09-05T10:00:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['BlockEnvelope']
			}
		}
		/** @description Option databases, without items. */
		DatabaseListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JCCD1GDJFMGT83PXT891WB09",
				 *           "name": "Serviços",
				 *           "slug": "servicos",
				 *           "is_required": false,
				 *           "is_multiple": true
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['DatabaseListEnvelope']
			}
		}
		/** @description The database and its items. */
		DatabaseOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "database": {
				 *           "id": "01JCCD1GDJFMGT83PXT891WB09",
				 *           "name": "Serviços",
				 *           "slug": "servicos",
				 *           "is_required": false,
				 *           "is_multiple": true
				 *         },
				 *         "items": [
				 *           {
				 *             "id": "01JCB9Y73MY63FCH26W14WMCHW",
				 *             "name": "Design",
				 *             "description": "Identidade visual e interfaces.",
				 *             "order": 0,
				 *             "created_at": "2026-09-06T10:00:00Z",
				 *             "updated_at": "2026-09-06T10:00:00Z"
				 *           },
				 *           {
				 *             "id": "01JCYFGCW8T7SWM4FV4DK79Q9G",
				 *             "name": "Logotipos",
				 *             "order": 1,
				 *             "parent_item_id": "01JCB9Y73MY63FCH26W14WMCHW",
				 *             "created_at": "2026-09-06T10:01:00Z",
				 *             "updated_at": "2026-09-06T10:01:00Z"
				 *           }
				 *         ]
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['DatabaseDetailEnvelope']
			}
		}
		/** @description Active link pages. */
		LinkPageListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JC8XE6SZAEAVSNTCPM5Q1NXW",
				 *           "title": "Example Studio",
				 *           "slug": "links",
				 *           "links": [],
				 *           "created_at": "2026-09-07T10:00:00Z",
				 *           "updated_at": "2026-09-07T10:00:00Z"
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['LinkPageListEnvelope']
			}
		}
		/** @description The link page. */
		LinkPageOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JC8XE6SZAEAVSNTCPM5Q1NXW",
				 *         "title": "Example Studio",
				 *         "slug": "links",
				 *         "subtitle": "Design e tecnologia",
				 *         "avatar_url": "https://media.example.com/01JCM9S346Q3D25VT4F5V37E3S/01JC9EE0ZBGJ09TQM83XSSSS6Y/master",
				 *         "links": [
				 *           {
				 *             "title": "Portfolio",
				 *             "url": "https://example.com/portfolio",
				 *             "icon": null,
				 *             "display_mode": "text"
				 *           }
				 *         ],
				 *         "theme": {
				 *           "background_color": "#101010",
				 *           "button_color": "#f5f5f5",
				 *           "text_color": "#101010",
				 *           "social_links": [
				 *             {
				 *               "platform": "instagram",
				 *               "url": "https://instagram.com/example"
				 *             }
				 *           ]
				 *         },
				 *         "created_at": "2026-09-07T10:00:00Z",
				 *         "updated_at": "2026-10-07T10:00:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['LinkPageEnvelope']
			}
		}
		/** @description Active form schemas. */
		FormListOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": [
				 *         {
				 *           "id": "01JC1RNJ47E65GH2BH8VGS9ZM5",
				 *           "key": "newsletter",
				 *           "name": "Newsletter",
				 *           "fields": [
				 *             {
				 *               "handle": "email",
				 *               "type": "email",
				 *               "label": "E-mail",
				 *               "required": true
				 *             }
				 *           ],
				 *           "honeypot_field": "_gotcha",
				 *           "created_at": "2026-09-08T10:00:00Z",
				 *           "updated_at": "2026-09-08T10:00:00Z"
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['FormListEnvelope']
			}
		}
		/** @description The form schema. */
		FormOk: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Rush-Perspective': components['headers']['RushPerspective']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "id": "01JC1RNJ47E65GH2BH8VGS9ZM5",
				 *         "key": "contact",
				 *         "name": "Contato",
				 *         "fields": [
				 *           {
				 *             "handle": "name",
				 *             "type": "text",
				 *             "label": "Nome",
				 *             "required": true,
				 *             "max_length": 120
				 *           },
				 *           {
				 *             "handle": "email",
				 *             "type": "email",
				 *             "label": "E-mail",
				 *             "placeholder": "voce@exemplo.com",
				 *             "required": true
				 *           },
				 *           {
				 *             "handle": "topics",
				 *             "type": "checkbox",
				 *             "label": "Assuntos",
				 *             "options": [
				 *               {
				 *                 "value": "support",
				 *                 "label": "Suporte"
				 *               },
				 *               {
				 *                 "value": "sales",
				 *                 "label": "Vendas"
				 *               }
				 *             ]
				 *           }
				 *         ],
				 *         "honeypot_field": "_gotcha",
				 *         "captcha": {
				 *           "provider": "turnstile",
				 *           "site_key": "1x00000000000000000000AA"
				 *         },
				 *         "created_at": "2026-09-08T10:00:00Z",
				 *         "updated_at": "2026-10-08T10:00:00Z"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['FormEnvelope']
			}
		}
		/** @description Received. A real submission and a discarded honeypot submission answer identically. */
		FormSubmitted: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "data": {
				 *         "received": true
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['FormSubmitEnvelope']
			}
		}
		/** @description The `If-None-Match` validator matches; no body. */
		NotModified: {
			headers: {
				ETag: components['headers']['ETag']
				'Cache-Control': components['headers']['CacheControl']
				Vary: components['headers']['Vary']
				'X-Cache': components['headers']['Cache']
				[name: string]: unknown
			}
			content?: never
		}
		/** @description `bad_request`: a query parameter or header is sent more than once. */
		BadRequestParameter: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "If-None-Match is sent more than once",
				 *       "code": "bad_request"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/** @description `invalid_perspective`: `perspective` is neither `published` nor `draft`. `bad_request`: a query parameter or header is sent more than once. */
		BadRequest: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "invalid perspective",
				 *       "code": "invalid_perspective"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `locale_not_served` (`params.available` lists the site's locales): `?locale=` names a locale the site does not
		 *     serve. `invalid_perspective`: `perspective` is neither `published` nor `draft`. `bad_request`: a query parameter or header is sent more than once.
		 */
		BadRequestLocale: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "locale \"fr\" is not served by this site",
				 *       "code": "locale_not_served",
				 *       "params": {
				 *         "available": [
				 *           "en",
				 *           "pt_BR",
				 *           "es"
				 *         ]
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `bad_request`: `page` or `per_page` is not a number, `type` is neither `tag` nor `category`, or a query
		 *     parameter or header is sent more than once.
		 *     `locale_not_served` (`params.available` lists the site's locales): `?locale=` names a locale the site does
		 *     not serve. `invalid_perspective`: `perspective` is neither `published` nor `draft`.
		 *     Precedence: `invalid_perspective` is decided with the token, before the other parameters; every
		 *     `bad_request` then comes before `locale_not_served`.
		 */
		BadRequestQuery: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "per_page must be a number",
				 *       "code": "bad_request"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `bad_request`: the body cannot be parsed as JSON, multipart or urlencoded, the form key does not match its
		 *     pattern, or a query parameter or header is sent more than once. `invalid_perspective`: `perspective` is neither
		 *     `published` nor `draft`.
		 */
		BadRequestSubmit: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "invalid submission body",
				 *       "code": "bad_request"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `unauthorized`: missing, unknown or revoked token, inactive site, or a preview link whose issuer lost the view
		 *     permission or whose links were revoked. `token_expired`: the API token or the preview link expired.
		 */
		Unauthorized: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "token expired",
				 *       "code": "token_expired"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `forbidden`: the token belongs to another site. `site_suspended`: the site's billing is suspended.
		 *     `preview_requires_preview_token`: `perspective=draft` with a delivery token.
		 */
		Forbidden: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "token belongs to another site",
				 *       "code": "forbidden"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `forbidden`, `site_suspended` and `preview_requires_preview_token` as on reads, plus `preview_cannot_submit`:
		 *     a preview token or the draft perspective cannot submit.
		 */
		ForbiddenSubmit: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "preview tokens cannot submit forms",
				 *       "code": "preview_cannot_submit"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `not_found`, with `params.resource` naming what is missing: `collection`, `tag`, `navigation`,
		 *     `site_option_group`, `block`, `database`, `link_page` or `form`.
		 */
		NotFound: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "collection not found",
				 *       "code": "not_found",
				 *       "params": {
				 *         "resource": "collection"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `not_found` (`params.resource: homepage`): no homepage in any served locale. `not_translated`
		 *     (`params.available` lists the locales that have one): the flag is off and L has none.
		 */
		NotFoundTranslatable: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "homepage not translated into es",
				 *       "code": "not_translated",
				 *       "params": {
				 *         "available": [
				 *           "en",
				 *           "pt_BR"
				 *         ]
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `moved` (`params.locale`, `params.slug`, `params.collection_id`, `params.collection_slug`): the entry lives at another URL for L;
		 *     redirect there. `not_translated` (`params.available`): the entry exists but has no served translation for L.
		 *     `not_found` (`params.resource`: `collection` or `entry`).
		 */
		NotFoundEntry: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "entry moved",
				 *       "code": "moved",
				 *       "params": {
				 *         "locale": "pt_BR",
				 *         "slug": "ola-mundo",
				 *         "collection_id": "01JC3E28JT97KB6CQ643DZVMXX",
				 *         "collection_slug": "artigos"
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/** @description `payload_too_large`: the body exceeds 1 MiB. */
		PayloadTooLarge: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "submission too large",
				 *       "code": "payload_too_large"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/**
		 * @description `validation_failed` with `errors` (one `FieldError` per failed rule). `captcha_failed`: captcha is enabled and
		 *     the token is missing or rejected.
		 */
		UnprocessableSubmit: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "validation failed",
				 *       "code": "validation_failed",
				 *       "errors": [
				 *         {
				 *           "field": "email",
				 *           "code": "invalid_email"
				 *         },
				 *         {
				 *           "field": "name",
				 *           "code": "too_long",
				 *           "params": {
				 *             "max": 120
				 *           }
				 *         }
				 *       ]
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/** @description `rate_limited` (`params.retry_after` in seconds, also in `Retry-After`). */
		RateLimited: {
			headers: {
				'Retry-After': components['headers']['RetryAfter']
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "too many requests, please retry later",
				 *       "code": "rate_limited",
				 *       "params": {
				 *         "retry_after": 42
				 *       }
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/** @description `internal_error`. */
		InternalError: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "internal server error",
				 *       "code": "internal_error"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
		/** @description `captcha_unavailable`: the captcha verifier could not be reached; retry later. */
		CaptchaUnavailable: {
			headers: {
				[name: string]: unknown
			}
			content: {
				/**
				 * @example {
				 *       "error": "captcha verifier unavailable",
				 *       "code": "captcha_unavailable"
				 *     }
				 */
				'application/json': components['schemas']['Error']
			}
		}
	}
	parameters: {
		/**
		 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
		 * @example 01JCM9S346Q3D25VT4F5V37E3S
		 */
		SiteId: components['schemas']['Ulid']
		/**
		 * @description Collection slug in any locale of the site.
		 * @example blog
		 */
		CollectionSlug: string
		/**
		 * @description Entry slug, current or retired, in any locale (see the resolution steps).
		 * @example hello-world
		 */
		EntrySlug: string
		/**
		 * @description Tag or category slug in any locale of the preference order.
		 * @example news
		 */
		TagSlug: string
		/**
		 * @description Navigation key.
		 * @example main
		 */
		NavigationKey: string
		/**
		 * @description Site option group slug.
		 * @example contact
		 */
		SiteOptionGroupSlug: string
		/**
		 * @description Block slug.
		 * @example call-to-action
		 */
		BlockSlug: string
		/**
		 * @description The database slug.
		 * @example services
		 */
		DatabaseSlug: string
		/**
		 * @description Link page slug.
		 * @example links
		 */
		LinkPageSlug: string
		/**
		 * @description Form key (lowercase letters, digits and single hyphens, at most 255 characters).
		 * @example contact
		 */
		FormKey: string
		/**
		 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
		 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
		 *     `400 locale_not_served`.
		 * @example pt_BR
		 */
		Locale: string
		/**
		 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
		 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
		 */
		Perspective: components['schemas']['Perspective']
		/** @description Page number, from 1. Below 1 means 1; a non-numeric value answers `400 bad_request`. */
		Page: number
		/**
		 * @description Page size. Below 1 means the operation's default; above 100 is clamped to 100; a non-numeric value answers
		 *     `400 bad_request`.
		 */
		PerPage: number
		/**
		 * @description Search text in PostgreSQL web-search syntax (quoted phrases, `or`, `-term`).
		 * @example hello world
		 */
		Query: string
		/** @description Which taxonomy to list; `tag` when omitted. Any other value answers `400 bad_request`. */
		TagType: components['schemas']['TagType']
		/** @description Restricts the slug to one taxonomy. Without it the slug resolves across both. Any other value answers `400 bad_request`. */
		EntriesTagType: components['schemas']['TagType']
		/**
		 * @description An `ETag` from an earlier response; a match answers `304`.
		 * @example "9f86d081884c7d659a2feaa0c55ad015"
		 */
		IfNoneMatch: string
		/**
		 * @description The visitor IP as seen by the site's server; a single IPv4 or IPv6 literal, otherwise ignored.
		 * @example 203.0.113.7
		 */
		ClientIp: string
		/** @description Turnstile token, when not sent as the body field `cf-turnstile-response`. */
		CaptchaToken: string
	}
	requestBodies: never
	headers: {
		/**
		 * @description Strong validator (hash of the body). Present on 200 and 304 in the published perspective only.
		 * @example "9f86d081884c7d659a2feaa0c55ad015"
		 */
		ETag: string
		/** @description `no-cache` in the published perspective (revalidate with `If-None-Match`); `no-store` in the draft perspective. */
		CacheControl: 'no-cache' | 'no-store'
		/**
		 * @description `Accept-Language` when the operation resolves a locale and `?locale=` was absent; `Origin` when CORS
		 *     applied.
		 * @example Accept-Language
		 */
		Vary: string
		/** @description Present, with value `draft`, only in the draft perspective. */
		RushPerspective: 'draft'
		/** @description Server cache state; `BYPASS` in the draft perspective or when the cache is unavailable. */
		Cache: 'HIT' | 'MISS' | 'BYPASS'
		/**
		 * @description Locale of the served translation, in BCP 47.
		 * @example pt-BR
		 */
		ContentLanguage: string
		/**
		 * @description Seconds until a new attempt may succeed.
		 * @example 42
		 */
		RetryAfter: number
	}
	pathItems: never
}
export type $defs = Record<string, never>
export interface operations {
	getOpenAPI: {
		parameters: {
			query?: never
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path?: never
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['OpenAPIDocument']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestParameter']
		}
	}
	getSite: {
		parameters: {
			query?: {
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['SiteOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequest']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getHomepage: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['HomepageOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFoundTranslatable']
			500: components['responses']['InternalError']
		}
	}
	listCollections: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['CollectionListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getCollection: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['CollectionOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listEntries: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
				/** @description Page number, from 1. Below 1 means 1; a non-numeric value answers `400 bad_request`. */
				page?: components['parameters']['Page']
				/**
				 * @description Page size. Below 1 means the operation's default; above 100 is clamped to 100; a non-numeric value answers
				 *     `400 bad_request`.
				 */
				per_page?: components['parameters']['PerPage']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['EntryPageOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestQuery']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	searchEntries: {
		parameters: {
			query?: {
				/**
				 * @description Search text in PostgreSQL web-search syntax (quoted phrases, `or`, `-term`).
				 * @example hello world
				 */
				q?: components['parameters']['Query']
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
				/** @description Page number, from 1. Below 1 means 1; a non-numeric value answers `400 bad_request`. */
				page?: components['parameters']['Page']
				/**
				 * @description Page size. Below 1 means the operation's default; above 100 is clamped to 100; a non-numeric value answers
				 *     `400 bad_request`.
				 */
				per_page?: components['parameters']['PerPage']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['EntryPageOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestQuery']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	getEntry: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Collection slug in any locale of the site.
				 * @example blog
				 */
				collection: components['parameters']['CollectionSlug']
				/**
				 * @description Entry slug, current or retired, in any locale (see the resolution steps).
				 * @example hello-world
				 */
				entry: components['parameters']['EntrySlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['EntryOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFoundEntry']
			500: components['responses']['InternalError']
		}
	}
	listTags: {
		parameters: {
			query?: {
				/** @description Which taxonomy to list; `tag` when omitted. Any other value answers `400 bad_request`. */
				type?: components['parameters']['TagType']
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['TagListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestQuery']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	listTagEntries: {
		parameters: {
			query?: {
				/** @description Restricts the slug to one taxonomy. Without it the slug resolves across both. Any other value answers `400 bad_request`. */
				type?: components['parameters']['EntriesTagType']
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
				/** @description Page number, from 1. Below 1 means 1; a non-numeric value answers `400 bad_request`. */
				page?: components['parameters']['Page']
				/**
				 * @description Page size. Below 1 means the operation's default; above 100 is clamped to 100; a non-numeric value answers
				 *     `400 bad_request`.
				 */
				per_page?: components['parameters']['PerPage']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Tag or category slug in any locale of the preference order.
				 * @example news
				 */
				tag: components['parameters']['TagSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['EntryPageOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestQuery']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listNavigations: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['NavigationListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getNavigation: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Navigation key.
				 * @example main
				 */
				key: components['parameters']['NavigationKey']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['NavigationOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listSiteOptionGroups: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['SiteOptionGroupListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getSiteOptionGroup: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Site option group slug.
				 * @example contact
				 */
				slug: components['parameters']['SiteOptionGroupSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['SiteOptionGroupOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listBlocks: {
		parameters: {
			query?: {
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['BlockListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequest']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getBlock: {
		parameters: {
			query?: {
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Block slug.
				 * @example call-to-action
				 */
				block: components['parameters']['BlockSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['BlockOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequest']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listDatabases: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['DatabaseListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getDatabase: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description The database slug.
				 * @example services
				 */
				database: components['parameters']['DatabaseSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['DatabaseOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listLinkPages: {
		parameters: {
			query?: {
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['LinkPageListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequest']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getLinkPage: {
		parameters: {
			query?: {
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Link page slug.
				 * @example links
				 */
				linkpage: components['parameters']['LinkPageSlug']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['LinkPageOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequest']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	listForms: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['FormListOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			500: components['responses']['InternalError']
		}
	}
	getForm: {
		parameters: {
			query?: {
				/**
				 * @description Requested locale. Matching ignores case and `-`/`_` and accepts a base language (`pt` → `pt_BR`). When absent,
				 *     `Accept-Language` decides, then the site default. A value the site does not serve answers
				 *     `400 locale_not_served`.
				 * @example pt_BR
				 */
				locale?: components['parameters']['Locale']
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description An `ETag` from an earlier response; a match answers `304`.
				 * @example "9f86d081884c7d659a2feaa0c55ad015"
				 */
				'If-None-Match'?: components['parameters']['IfNoneMatch']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Form key (lowercase letters, digits and single hyphens, at most 255 characters).
				 * @example contact
				 */
				key: components['parameters']['FormKey']
			}
			cookie?: never
		}
		requestBody?: never
		responses: {
			200: components['responses']['FormOk']
			304: components['responses']['NotModified']
			400: components['responses']['BadRequestLocale']
			401: components['responses']['Unauthorized']
			403: components['responses']['Forbidden']
			404: components['responses']['NotFound']
			500: components['responses']['InternalError']
		}
	}
	submitForm: {
		parameters: {
			query?: {
				/**
				 * @description `published` (default for delivery tokens) or `draft` (default for preview tokens; a delivery token gets
				 *     `403 preview_requires_preview_token`). Any other value answers `400 invalid_perspective`.
				 */
				perspective?: components['parameters']['Perspective']
			}
			header?: {
				/**
				 * @description The visitor IP as seen by the site's server; a single IPv4 or IPv6 literal, otherwise ignored.
				 * @example 203.0.113.7
				 */
				'X-Rush-Client-IP'?: components['parameters']['ClientIp']
				/** @description Turnstile token, when not sent as the body field `cf-turnstile-response`. */
				'X-Captcha-Token'?: components['parameters']['CaptchaToken']
			}
			path: {
				/**
				 * @description The site id (ULID), never its slug. Must be the site the token belongs to.
				 * @example 01JCM9S346Q3D25VT4F5V37E3S
				 */
				site_id: components['parameters']['SiteId']
				/**
				 * @description Form key (lowercase letters, digits and single hyphens, at most 255 characters).
				 * @example contact
				 */
				key: components['parameters']['FormKey']
			}
			cookie?: never
		}
		requestBody: {
			content: {
				/**
				 * @example {
				 *       "name": "Ana",
				 *       "email": "ana@example.com",
				 *       "topics": [
				 *         "support",
				 *         "sales"
				 *       ],
				 *       "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX"
				 *     }
				 */
				'application/json': components['schemas']['FormSubmission']
				'application/x-www-form-urlencoded': components['schemas']['FormSubmission']
				'multipart/form-data': components['schemas']['FormSubmission']
			}
		}
		responses: {
			201: components['responses']['FormSubmitted']
			400: components['responses']['BadRequestSubmit']
			401: components['responses']['Unauthorized']
			403: components['responses']['ForbiddenSubmit']
			404: components['responses']['NotFound']
			413: components['responses']['PayloadTooLarge']
			422: components['responses']['UnprocessableSubmit']
			429: components['responses']['RateLimited']
			500: components['responses']['InternalError']
			503: components['responses']['CaptchaUnavailable']
		}
	}
}
