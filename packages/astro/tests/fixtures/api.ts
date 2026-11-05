import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parameterExample, responseExample } from '../../../client/tests/fixtures/contract'
import { isRecord } from '@rushcms/client'
import type { Entry } from '@rushcms/client'
import type { RushApiSettings } from '../../src/settings'

export type StubRequest = {
	method: string
	path: string
	query: URLSearchParams
	headers: Headers
	body: Uint8Array<ArrayBuffer>
}

export type StubHandler = (request: StubRequest) => Response | Promise<Response>

export type StubApi = {
	api: RushApiSettings
	requests: StubRequest[]
	handle(handler: StubHandler): void
	close(): Promise<void>
}

export const SITE_ID = parameterExample('SiteId')
export const TOKEN = 'stub-delivery-token'
export const SITE_PREFIX = `/api/v1/${SITE_ID}`

function headersOf(message: IncomingMessage): Headers {
	const headers = new Headers()
	for (const [name, value] of Object.entries(message.headers)) {
		for (const item of [value ?? []].flat()) {
			headers.append(name, item)
		}
	}
	return headers
}

async function bodyOf(message: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
	const chunks: Uint8Array[] = []
	for await (const chunk of message) {
		chunks.push(chunk as Uint8Array)
	}
	return new Uint8Array(Buffer.concat(chunks))
}

async function send(response: Response, out: ServerResponse): Promise<void> {
	out.writeHead(response.status, Object.fromEntries(response.headers))
	out.end(Buffer.from(await response.arrayBuffer()))
}

export const PAGE_META = { total: 1, per_page: 100, current_page: 1, last_page: 1 }

export function entryListsByLocale(entriesByLocale: Record<string, Entry[]>): StubHandler {
	return (request) =>
		Response.json({
			data: entriesByLocale[request.query.get('locale') ?? ''] ?? [],
			meta: PAGE_META
		})
}

export function envelope(data: unknown, status = 200): Response {
	return Response.json({ data }, { status })
}

export function apiError(status: number, body: Record<string, unknown>): Response {
	return Response.json(body, { status })
}

export function siteExample(): Record<string, unknown> {
	const example = responseExample('SiteOk')
	if (!isRecord(example) || !isRecord(example.data)) {
		throw new Error('SiteOk example has no data object')
	}
	return example.data
}

export function asRequest(stub: StubRequest): Request {
	return new Request(`http://stub${stub.path}`, {
		method: stub.method,
		headers: stub.headers,
		body: stub.body
	})
}

export async function startStubApi(): Promise<StubApi> {
	const requests: StubRequest[] = []
	let handler: StubHandler = () => apiError(404, { error: 'not found', code: 'not_found' })
	const server = createServer((message, out) => {
		void (async () => {
			const url = new URL(message.url ?? '/', 'http://stub')
			const request: StubRequest = {
				method: message.method ?? 'GET',
				path: url.pathname,
				query: url.searchParams,
				headers: headersOf(message),
				body: await bodyOf(message)
			}
			requests.push(request)
			await send(await handler(request), out)
		})()
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const { port } = server.address() as AddressInfo
	return {
		api: { url: `http://127.0.0.1:${port}`, siteId: SITE_ID, token: TOKEN },
		requests,
		handle: (next) => {
			handler = next
		},
		close: () => new Promise<void>((resolve) => server.close(() => resolve()))
	}
}
