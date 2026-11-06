import { isRushError } from '@rushcms/client'
import type { Entry, LocaleCode, RushClient } from '@rushcms/client'
import { entryPathIn } from './urls'

export type EntryLookup =
	{ kind: 'found'; entry: Entry } | { kind: 'moved'; location: string } | { kind: 'missing' }

export async function lookupEntry(
	rush: RushClient,
	locale: LocaleCode,
	collection: string,
	slug: string
): Promise<EntryLookup> {
	try {
		return { kind: 'found', entry: await rush.entries.get(collection, slug, { locale }) }
	} catch (err) {
		if (isRushError(err, 'moved')) {
			const { params } = err
			const target = await rush.entries.get(params.collection_slug, params.slug, {
				locale: params.locale
			})
			return { kind: 'moved', location: entryPathIn(target, params.locale) }
		}
		if (isRushError(err) && err.status === 404) {
			return { kind: 'missing' }
		}
		throw err
	}
}
