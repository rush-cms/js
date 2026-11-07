import { isRushError } from '@rushcms/client'
import type { CollectionRef, Entry, LocaleCode, MovedParams, RushUrls } from '@rushcms/client'
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

type EntryRequest = {
	locale: LocaleCode
	collection: string
	slug: string
	segmentParam: boolean
}

function fixedCollection(
	urls: RushUrls,
	ref: CollectionRef | undefined
): CollectionRef | undefined {
	return ref !== undefined && !urls.hasCollectionSegment(ref) ? ref : undefined
}

function movedTarget(params: MovedParams): CollectionRef {
	return { id: params.collection_id, slug: params.collection_slug }
}

function isMissing(err: unknown): boolean {
	return MISSING_CODES.some((code) => isRushError(err, code))
}

async function fetchEntry(
	runtime: RushRuntime,
	context: RushContext,
	request: EntryRequest
): Promise<EntryResolution> {
	const { locale, slug } = request
	const permanent = !runtime.previewMode
	const ref = runtime.urls.collectionRef(request.collection, locale)
	if (ref !== undefined && !runtime.urls.routed(ref)) {
		return MISSING
	}
	const fixed = fixedCollection(runtime.urls, ref)
	try {
		const entry = await runtime
			.clientIn(context, locale)
			.entries.get(fixed?.slug ?? request.collection, slug, { locale })
		return fixed !== undefined && request.segmentParam
			? { kind: 'moved', location: runtime.urls.servedPath(entry, locale), permanent }
			: { kind: 'found', entry, locale }
	} catch (err) {
		if (isRushError(err, 'moved')) {
			return runtime.urls.routed(movedTarget(err.params))
				? { kind: 'moved', location: runtime.urls.moved(err.params), permanent }
				: MISSING
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
	return fetchEntry(runtime, context, {
		locale,
		collection,
		slug,
		segmentParam: route.collection === undefined
	})
}
