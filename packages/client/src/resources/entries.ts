import type { EntriesResource } from '../types'
import type { ResourceContext } from './context'

const WALK_PAGE_SIZE = 100

export function createEntries(context: ResourceContext): EntriesResource {
	const list: EntriesResource['list'] = (collection, options) =>
		context.page<'listEntries'>(['collections', collection, 'entries'], options, 'localized')

	return {
		list,
		get: (collection, slug, options) =>
			context.data<'getEntry'>(
				['collections', collection, 'entries', slug],
				options,
				'localized'
			),
		search: (collection, query, options) =>
			context.page<'searchEntries'>(
				['collections', collection, 'search'],
				{ ...options, q: query },
				'localized'
			),
		async *all(collection, options) {
			const first = await list(collection, { ...options, page: 1, per_page: WALK_PAGE_SIZE })
			yield* first.items
			for (let page = 2; page <= first.meta.last_page; page++) {
				const next = await list(collection, { ...options, page, per_page: WALK_PAGE_SIZE })
				yield* next.items
			}
		}
	}
}
