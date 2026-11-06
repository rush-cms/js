import type { EntryResolution } from '@rushcms/astro'
import type { RushUrls } from '@rushcms/client'
import { RUSH_PREVIEW } from 'astro:env/server'

function notFound(): Response {
	return new Response(null, { status: 404 })
}

function redirectTo(location: string, permanent: boolean): Response {
	return new Response(null, {
		status: permanent ? 301 : 302,
		headers: { Location: location }
	})
}

export function redirectOrNotFound(resolution: EntryResolution | undefined): Response {
	return resolution?.kind === 'moved'
		? redirectTo(resolution.location, resolution.permanent)
		: notFound()
}

export function redirectToServedPath(
	resolution: EntryResolution | undefined,
	urls: RushUrls,
	pathname: string
): Response {
	if (resolution?.kind !== 'found') {
		return redirectOrNotFound(resolution)
	}
	const served = urls.servedPath(resolution.entry, resolution.locale)
	return served === pathname ? notFound() : redirectTo(served, !RUSH_PREVIEW)
}
