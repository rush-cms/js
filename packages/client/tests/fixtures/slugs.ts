import { entryExample } from './contract'

const TRANSLATIONS = Object.entries(entryExample().translations)

export const COLLECTION_SLUGS: Record<string, string> = Object.fromEntries(
	TRANSLATIONS.map(([locale, translation]) => [locale, translation.collection_slug])
)

export const ENTRY_SLUGS: Record<string, string> = Object.fromEntries(
	TRANSLATIONS.map(([locale, translation]) => [locale, translation.slug])
)
