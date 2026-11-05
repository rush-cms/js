import type { TagsResource } from '../types'
import type { ResourceContext } from './context'

export function createTags(context: ResourceContext): TagsResource {
	return {
		list: (options) => context.data<'listTags'>(['tags'], options, 'localized'),
		entries: (tag, options) =>
			context.page<'listTagEntries'>(['tags', tag, 'entries'], options, 'localized')
	}
}
