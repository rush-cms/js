import type { EntryResolution } from '@rushcms/astro'

export function redirectOrNotFound(resolution: EntryResolution | undefined): Response {
	return resolution?.kind === 'moved'
		? new Response(null, { status: 301, headers: { Location: resolution.location } })
		: new Response(null, { status: 404 })
}
