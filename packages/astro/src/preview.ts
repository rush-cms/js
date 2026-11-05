import { isRecord, isRushError } from '@rushcms/client'
import type { LocaleCode, RushClient, RushUrls } from '@rushcms/client'
import type { APIContext } from 'astro'
import { attachRuntime, runtimeOf } from './runtime'
import type { RushRuntime } from './runtime'
import { sameOriginUrl } from './same-origin'

export type CookieValue = {
	value: string
}

export type CookieReader = {
	get(name: string): CookieValue | undefined
}

export type RushMiddlewareContext = {
	locals: object
	cookies: CookieReader
}

export type RushMiddleware = (
	context: RushMiddlewareContext,
	next: () => Promise<Response>
) => Promise<Response>

export type PreviewContext = Pick<APIContext, 'url' | 'locals'>

type PreviewTarget = {
	locale: LocaleCode
	collection: string
	slug: string
}

type PreviewRequest = {
	token: string
	expiresAt: number
	target: PreviewTarget
}

export const PREVIEW_COOKIE = 'rush_preview'

const TOKEN_PATTERN = /^rush_prv_([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+$/

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

const PREVIEW_HEADERS: Record<string, string> = {
	'X-Robots-Tag': 'noindex',
	'Cache-Control': 'no-store'
}

function applyPreviewHeaders(headers: Headers): void {
	for (const [name, value] of Object.entries(PREVIEW_HEADERS)) {
		headers.set(name, value)
	}
}

function withPreviewHeaders(response: Response): Response {
	try {
		applyPreviewHeaders(response.headers)
		return response
	} catch {
		const copy = new Response(response.body, response)
		applyPreviewHeaders(copy.headers)
		return copy
	}
}

function isPreviewToken(value: string): boolean {
	return TOKEN_PATTERN.test(value)
}

export function createRushMiddleware(runtime: RushRuntime): RushMiddleware {
	if (!runtime.previewMode) {
		return (context, next) => {
			attachRuntime(context.locals, runtime)
			return next()
		}
	}
	return async (context, next) => {
		const token = context.cookies.get(PREVIEW_COOKIE)?.value
		const scoped =
			token !== undefined && isPreviewToken(token) ? runtime.preview(token) : runtime
		attachRuntime(context.locals, scoped)
		return withPreviewHeaders(await next())
	}
}

function decodeBase64Url(value: string): string {
	const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
	return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

function expiryOf(token: string): number | undefined {
	const payload = TOKEN_PATTERN.exec(token)?.[1]
	if (payload === undefined) {
		return undefined
	}
	try {
		const claims: unknown = JSON.parse(decodeBase64Url(payload))
		return isRecord(claims) && Number.isSafeInteger(claims.exp) ? Number(claims.exp) : undefined
	} catch {
		return undefined
	}
}

function present(params: URLSearchParams, name: string): string | undefined {
	const value = params.get(name)
	return value === null || value === '' ? undefined : value
}

function readPreviewRequest(params: URLSearchParams, urls: RushUrls): PreviewRequest | undefined {
	const token = present(params, 'token')
	const locale = present(params, 'locale')
	const collection = present(params, 'collection') ?? ''
	const slug = present(params, 'slug') ?? ''
	const expiresAt = token === undefined ? undefined : expiryOf(token)
	if (
		token === undefined ||
		expiresAt === undefined ||
		locale === undefined ||
		!urls.locales.includes(locale) ||
		(collection === '') !== (slug === '')
	) {
		return undefined
	}
	return { token, expiresAt, target: { locale, collection, slug } }
}

async function targetPath(
	client: RushClient,
	urls: RushUrls,
	target: PreviewTarget
): Promise<string> {
	if (target.collection === '') {
		return urls.homepage(target.locale)
	}
	return urls.entry(
		await client.entries.get(target.collection, target.slug, { locale: target.locale })
	)
}

function plain(status: number, message: string): Response {
	return new Response(message, {
		status,
		headers: { 'Content-Type': 'text/plain; charset=utf-8', ...PREVIEW_HEADERS }
	})
}

function invalidLink(): Response {
	return plain(400, 'Invalid preview link')
}

function failure(status: number): Response {
	if (status === 401 || status === 403) {
		return plain(401, 'Preview link rejected')
	}
	return status === 404
		? plain(404, 'Preview target not found')
		: plain(502, 'Preview unavailable')
}

function previewCookie(url: URL, value: string, maxAge: number): string {
	const secure = LOOPBACK_HOSTS.includes(url.hostname) ? '' : '; Secure'
	return `${PREVIEW_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`
}

function seeOther(location: string, cookie: string): Response {
	return new Response(null, {
		status: 303,
		headers: { Location: location, 'Set-Cookie': cookie, ...PREVIEW_HEADERS }
	})
}

function enterPreview(url: URL, request: PreviewRequest, path: string): Response {
	const maxAge = request.expiresAt - Math.floor(Date.now() / 1000)
	if (maxAge < 1) {
		return failure(401)
	}
	const target = sameOriginUrl(path, url, url)
	if (target === undefined) {
		return invalidLink()
	}
	return seeOther(target.href, previewCookie(url, request.token, maxAge))
}

function previewRuntime(context: PreviewContext): RushRuntime | undefined {
	const runtime = runtimeOf(context.locals)
	return runtime.previewMode ? runtime : undefined
}

function notFound(): Response {
	return plain(404, 'Not found')
}

export async function startPreview(context: PreviewContext): Promise<Response> {
	const runtime = previewRuntime(context)
	if (runtime === undefined) {
		return notFound()
	}
	const request = readPreviewRequest(context.url.searchParams, runtime.urls)
	if (request === undefined) {
		return invalidLink()
	}
	const client = runtime.preview(request.token).onDemandClient()
	try {
		await client.site.get()
		const path = await targetPath(client, runtime.urls, request.target)
		return enterPreview(context.url, request, path)
	} catch (err) {
		if (!isRushError(err)) {
			throw err
		}
		return failure(err.status)
	}
}

export function exitPreview(context: PreviewContext): Response {
	if (previewRuntime(context) === undefined) {
		return notFound()
	}
	const target = sameOriginUrl(context.url.searchParams.get('return'), context.url, context.url)
	return seeOther(target?.href ?? '/', previewCookie(context.url, '', 0))
}
