import type { RushFetch } from '@rushcms/client'

export type PreviewSession = {
	expired: boolean
}

function publishedUrl(input: string): string {
	const url = new URL(input)
	url.searchParams.delete('perspective')
	return url.href
}

function deliveryInit(init: RequestInit, token: string): RequestInit {
	const headers = new Headers(init.headers)
	headers.set('Authorization', `Bearer ${token}`)
	return { ...init, headers }
}

export function fallbackFetch(deliveryToken: string, session: PreviewSession): RushFetch {
	return async (input, init) => {
		if (!session.expired) {
			const response = await fetch(input, init)
			if (response.status !== 401) {
				return response
			}
			await response.body?.cancel()
			session.expired = true
		}
		return fetch(publishedUrl(input), deliveryInit(init, deliveryToken))
	}
}
