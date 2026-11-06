import { isRushError } from '@rushcms/client'
import type { Entry, LocaleCode, RushUrls } from '@rushcms/client'
import type { EntryStaticPath } from './paths'
import { findLocale, localeRequest, runtimeOf } from './runtime'
import type { RushContext, RushRuntime } from './runtime'

export type EntryRouteProps = Partial<EntryStaticPath['props']>

export type EntryRouteContext = RushContext & {
	props: EntryRouteProps
}

export type EntryRoute = {
	locale?: string | undefined
	collection?: string | undefined
	slug?: string | undefined
}

export type EntryFound = {
	kind: 'found'
	entry: Entry
	locale: LocaleCode
}

export type EntryMoved = {
	kind: 'moved'
	location: string
	permanent: boolean
}

export type EntryMissing = {
	kind: 'missing'
}

export type EntryResolution = EntryFound | EntryMoved | EntryMissing

const MISSING: EntryMissing = { kind: 'missing' }

const MISSING_CODES = ['not_found', 'not_translated', 'locale_not_served'] as const

function requestedCollection(urls: RushUrls, key: string, locale: LocaleCode): string {
	const ref = urls.collectionRef(key, locale)
	const fixed =
		ref !== undefined && !Object.hasOwn(urls.entryParams(ref, locale, ''), 'collection')
	return fixed ? ref.slug : key
}

function isMissing(err: unknown): boolean {
	return MISSING_CODES.some((code) => isRushError(err, code))
}

async function fetchEntry(
	runtime: RushRuntime,
	context: RushContext,
	locale: LocaleCode,
	collection: string,
	slug: string
): Promise<EntryResolution> {
	try {
		const entry = await runtime
			.clientIn(context, locale)
			.entries.get(requestedCollection(runtime.urls, collection, locale), slug, { locale })
		return { kind: 'found', entry, locale }
	} catch (err) {
		if (isRushError(err, 'moved')) {
			return {
				kind: 'moved',
				location: runtime.urls.moved(err.params),
				permanent: !runtime.previewMode
			}
		}
		if (isMissing(err)) {
			return MISSING
		}
		throw err
	}
}

export async function resolveEntry(
	context: EntryRouteContext,
	route: EntryRoute = {}
): Promise<EntryResolution> {
	const runtime = runtimeOf(context.locals)
	const locale = findLocale(
		runtime.urls,
		runtime.defaultLocale,
		localeRequest(context, route.locale)
	)
	if (locale === undefined) {
		return MISSING
	}
	const { entry } = context.props
	if (entry !== undefined) {
		return { kind: 'found', entry, locale }
	}
	const collection = route.collection ?? context.params.collection
	const slug = route.slug ?? context.params.slug
	if (!collection || !slug) {
		return MISSING
	}
	return fetchEntry(runtime, context, locale, collection, slug)
}
