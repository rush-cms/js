import { createRequestReuse } from './dedupe'
import { clientError, errorFromBody } from './errors'
import { isRecord } from './json'
import type { EtagRecord, RushClientConfig, RushFetch } from './types'

export type QueryValue = string | number | boolean | undefined

export type QueryParams = Readonly<Record<string, QueryValue>>

export type RequestHeaders = Record<string, string>

export type EnvelopeShape = 'data' | 'page'

export type Transport = {
	get(segments: readonly string[], query: QueryParams, shape: EnvelopeShape): Promise<unknown>
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

function originOf(url: string): string | undefined {
	return URL.canParse(url) ? new URL(url).origin : undefined
}

function assertSameOrigin(url: string, response: Response): void {
	const configured = originOf(url)
	const final = originOf(response.url)
	if (!response.redirected || configured === undefined || final === undefined) {
		return
	}
	if (configured !== final) {
		throw clientError(
			response.status,
			'invalid_response',
			`the API at ${configured} redirected to ${final}, which drops the Authorization header; set the API URL to ${final}`
		)
	}
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

function isEnvelope(body: unknown, shape: EnvelopeShape): boolean {
	if (!isRecord(body) || !('data' in body)) {
		return false
	}
	return shape === 'data' || (Array.isArray(body.data) && isRecord(body.meta))
}

function isUsableRecord(
	record: EtagRecord | undefined,
	shape: EnvelopeShape
): record is EtagRecord {
	return isRecord(record) && typeof record.etag === 'string' && isEnvelope(record.body, shape)
}

async function settle(response: Response, shape: EnvelopeShape): Promise<unknown> {
	const body = await readJson(response)
	if (!response.ok) {
		throw errorFromBody(response.status, body)
	}
	if (!isEnvelope(body, shape)) {
		throw clientError(
			response.status,
			'invalid_response',
			`response is not a ${shape} envelope`
		)
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
		let response: Response
		try {
			response = await send(url, init)
		} catch (cause) {
			throw clientError(0, 'network_error', `request to ${url} failed`, cause)
		}
		assertSameOrigin(url, response)
		return response
	}

	async function revalidate(url: string, key: string, shape: EnvelopeShape): Promise<unknown> {
		const stored = store ? await store.get(key) : undefined
		const cached = isUsableRecord(stored, shape) ? stored : undefined
		const conditional: RequestHeaders = cached ? { 'If-None-Match': cached.etag } : {}
		const response = await exchange(url, { method: 'GET', headers: headersOf(conditional) })
		if (response.status === 304 && cached) {
			return cached.body
		}
		const body = await settle(response, shape)
		const etag = response.headers.get('ETag')
		if (store && etag) {
			await store.set(key, { etag, body })
		}
		return body
	}

	return {
		get(segments, query, shape) {
			const url = urlOf(segments, query)
			const key = ['GET', url, String(query.perspective ?? ''), identity].join(' ')
			return reuse.run(key, () => revalidate(url, key, shape))
		},
		async post(segments, body, headers) {
			const url = urlOf(segments, {})
			return settle(
				await exchange(url, { method: 'POST', headers: headersOf(headers), body }),
				'data'
			)
		}
	}
}
