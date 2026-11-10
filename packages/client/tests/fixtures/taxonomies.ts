import type { RushLocalePaths, RushTaxonomies, Tag, TagType } from '../../src/index'

export type TagInit = {
	type: TagType
	slug: string
	entryCount?: number
	id?: string
}

export const TAXONOMY_LOCALE_PATHS: RushLocalePaths = { pt_BR: 'br', en: '', es: 'es' }

export const TAXONOMIES: RushTaxonomies = {
	category: { pt_BR: 'categoria', en: 'category', es: 'categoria' },
	tag: { pt_BR: 'tag', en: 'tag', es: 'etiqueta' }
}

export function tagOf(init: TagInit): Tag {
	return {
		id: init.id ?? `${init.type}-${init.slug}`,
		type: init.type,
		name: init.slug,
		slug: init.slug,
		entry_count: init.entryCount ?? 1
	}
}
