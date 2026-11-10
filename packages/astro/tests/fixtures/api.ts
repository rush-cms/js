import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { parameterExample, responseExample } from '../../../client/tests/fixtures/contract'
import { isRecord } from '@rushcms/client/internal'
import type { Entry, LocaleCode, Tag, TagType } from '@rushcms/client'
import type { RushApiSettings } from '../../src/settings'

export type StubRequest = {
	method: string
	path: string
	query: URLSearchParams
	headers: Headers
	body: Uint8Array<ArrayBuffer>
}

export type StubHandler = (request: StubRequest) => Response | Promise<Response>

export type TagCatalog = {
	tags: Record<LocaleCode, Tag[]>
	entries: Record<string, Entry[]>
}

export type StubApi = {
	api: RushApiSettings
	requests: StubRequest[]
	handle(handler: StubHandler): void
	close(): Promise<void>
}

export const SITE_ID = parameterExample('SiteId')
export const TOKEN = 'stub-delivery-token'
export const SITE_PREFIX = `/api/v1/${SITE_ID}`
export const TAG_ENTRIES = /^\/tags\/([^/]+)\/entries$/

const TAG_PAGE_SIZE = 15

const TIE_ORDER: readonly TagType[] = ['tag', 'category']

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

function positive(value: string | null, fallback: number): number {
	const parsed = Number(value)
	return value === null || !Number.isInteger(parsed) || parsed < 1 ? fallback : parsed
}

export function pagedResponse(
	all: Entry[],
	request: StubRequest,
	defaultPerPage: number
): Response {
	const perPage = positive(request.query.get('per_page'), defaultPerPage)
	const page = positive(request.query.get('page'), 1)
	return Response.json({
		data: all.slice((page - 1) * perPage, page * perPage),
		meta: {
			total: all.length,
			per_page: perPage,
			current_page: page,
			last_page: Math.ceil(all.length / perPage)
		}
	})
}

export function tagEntriesKey(locale: LocaleCode, tag: Pick<Tag, 'type' | 'slug'>): string {
	return `${locale}:${tag.type}:${tag.slug}`
}

function slugTag(tags: Tag[], slug: string, type: string | null): Tag | undefined {
	const types = type === null ? TIE_ORDER : TIE_ORDER.filter((candidate) => candidate === type)
	return types
		.map((candidate) => tags.find((tag) => tag.type === candidate && tag.slug === slug))
		.find((tag) => tag !== undefined)
}

function preferenceOrder(catalog: TagCatalog, locale: LocaleCode): Tag[][] {
	const others = Object.entries(catalog.tags).filter(([code]) => code !== locale)
	return [catalog.tags[locale] ?? [], ...others.map(([, tags]) => tags)]
}

function resolvedTag(
	catalog: TagCatalog,
	locale: LocaleCode,
	slug: string,
	type: string | null
): Tag | undefined {
	const found = preferenceOrder(catalog, locale)
		.map((tags) => slugTag(tags, slug, type))
		.find((tag) => tag !== undefined)
	return found === undefined
		? undefined
		: ((catalog.tags[locale] ?? []).find((tag) => tag.id === found.id) ?? found)
}

export function tagResponse(
	catalog: TagCatalog | undefined,
	request: StubRequest
): Response | undefined {
	if (catalog === undefined) {
		return undefined
	}
	const path = request.path.slice(SITE_PREFIX.length)
	const locale = request.query.get('locale') ?? ''
	const tags = catalog.tags[locale] ?? []
	if (path === '/tags') {
		const type = request.query.get('type') ?? 'tag'
		return envelope(tags.filter((tag) => tag.type === type))
	}
	const [, slug] = TAG_ENTRIES.exec(path) ?? []
	if (slug === undefined) {
		return undefined
	}
	const tag = resolvedTag(catalog, locale, slug, request.query.get('type'))
	return tag === undefined
		? notFound('tag')
		: pagedResponse(catalog.entries[tagEntriesKey(locale, tag)] ?? [], request, TAG_PAGE_SIZE)
}

export function envelope(data: unknown, status = 200): Response {
	return Response.json({ data }, { status })
}

export function apiError(status: number, body: Record<string, unknown>): Response {
	return Response.json(body, { status })
}

export function notFound(resource: string): Response {
	return apiError(404, { error: 'not found', code: 'not_found', params: { resource } })
}

export function exampleData(name: string): Record<string, unknown> {
	const example = responseExample(name)
	if (!isRecord(example) || !isRecord(example.data)) {
		throw new Error(`${name} example has no data object`)
	}
	return example.data
}

export function siteExample(): Record<string, unknown> {
	return exampleData('SiteOk')
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
