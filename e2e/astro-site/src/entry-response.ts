import type { EntryResolution } from '@rushcms/astro'

export function redirectOrNotFound(resolution: EntryResolution | undefined): Response {
	return resolution?.kind === 'moved'
		? new Response(null, {
				status: resolution.permanent ? 301 : 302,
				headers: { Location: resolution.location }
			})
		: new Response(null, { status: 404 })
}
