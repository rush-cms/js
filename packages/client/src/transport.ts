import { createRequestReuse } from './dedupe'
import { clientError, errorFromBody } from './errors'
import { isRecord } from './json'
import type { RushClientConfig, RushFetch } from './types'

export type QueryValue = string | number | boolean | undefined

export type QueryParams = Readonly<Record<string, QueryValue>>

export type RequestHeaders = Record<string, string>

export type Transport = {
	get(segments: readonly string[], query: QueryParams): Promise<unknown>
	post(segments: readonly string[], body: BodyInit, headers: RequestHeaders): Promise<unknown>
}

const globalFetch: RushFetch = (input, init) => fetch(input, init)

function fingerprint(value: string): string {
	let hash = 0x811c9dc5
	for (let index = 0; index < value.length; index++) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0
	}
	return hash.toString(16)
}

function searchOf(query: QueryParams): string {
	const search = new URLSearchParams()
	for (const name of Object.keys(query).sort()) {
		const value = query[name]
		if (value !== undefined) {
			search.set(name, String(value))
		}
	}
	const encoded = search.toString()
	return encoded === '' ? '' : `?${encoded}`
}

async function readText(response: Response): Promise<string> {
	try {
		return await response.text()
	} catch (cause) {
		throw clientError(
			response.status,
			'network_error',
			'response body could not be read',
			cause
		)
	}
}

async function readJson(response: Response): Promise<unknown> {
	const text = await readText(response)
	try {
		return JSON.parse(text) as unknown
	} catch {
		return undefined
	}
}

async function settle(response: Response): Promise<unknown> {
	const body = await readJson(response)
	if (!response.ok) {
		throw errorFromBody(response.status, body)
	}
	if (!isRecord(body) || !('data' in body)) {
		throw clientError(response.status, 'invalid_response', 'response is not a data envelope')
	}
	return body
}

export function createTransport(config: RushClientConfig): Transport {
	const base = `${config.url.replace(/\/+$/, '')}/api/v1/${encodeURIComponent(config.siteId)}`
	const send = config.fetch ?? globalFetch
	const reuse = createRequestReuse(config.memo === true)
	const identity = fingerprint(config.token)
	const store = config.etagStore

	function urlOf(segments: readonly string[], query: QueryParams): string {
		return `${base}/${segments.map(encodeURIComponent).join('/')}${searchOf(query)}`
	}

	function headersOf(extra: RequestHeaders): RequestHeaders {
		return { Accept: 'application/json', Authorization: `Bearer ${config.token}`, ...extra }
	}

	async function exchange(url: string, init: RequestInit): Promise<Response> {
		try {
			return await send(url, init)
		} catch (cause) {
			throw clientError(0, 'network_error', `request to ${url} failed`, cause)
		}
	}

	async function revalidate(url: string, key: string): Promise<unknown> {
		const cached = store ? await store.get(key) : undefined
		const conditional: RequestHeaders = cached ? { 'If-None-Match': cached.etag } : {}
		const response = await exchange(url, { method: 'GET', headers: headersOf(conditional) })
		if (response.status === 304 && cached) {
			return cached.body
		}
		const body = await settle(response)
		const etag = response.headers.get('ETag')
		if (store && etag) {
			await store.set(key, { etag, body })
		}
		return body
	}

	return {
		get(segments, query) {
			const url = urlOf(segments, query)
			const key = ['GET', url, String(query.perspective ?? ''), identity].join(' ')
			return reuse.run(key, () => revalidate(url, key))
		},
		async post(segments, body, headers) {
			const url = urlOf(segments, {})
			return settle(
				await exchange(url, { method: 'POST', headers: headersOf(headers), body })
			)
		}
	}
}
