import { isRushError } from '@rushcms/client'
import { isRecord } from '@rushcms/client/internal'
import type { LocaleCode, RouteParams, RushClient, RushUrls } from '@rushcms/client'
import type { APIContext } from 'astro'
import { seeOther } from './http'
import type { PreviewSession } from './preview-session'
import { attachRuntime, runtimeOf } from './runtime'
import type { RushRuntime } from './runtime'
import { sameOriginUrl } from './same-origin'

export type CookieValue = {
	value: string
}

export type CookieReader = {
	get(name: string): CookieValue | undefined
}

export type CookieContext = {
	cookies: CookieReader
}

export type PreviewContext = Pick<APIContext, 'url' | 'locals' | 'request'>

export type RushMiddlewareContext = PreviewContext & CookieContext & Pick<APIContext, 'params'>

export type RushMiddleware = (
	context: RushMiddlewareContext,
	next: () => Promise<Response>
) => Promise<Response>

type PreviewTarget = {
	locale: LocaleCode
	collection: string
	slug: string
}

type HostTrust = 'public' | 'loopback' | 'untrusted'

type PreviewScope = {
	runtime: RushRuntime
	secure: boolean
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

function runtimeMiddleware(runtime: RushRuntime): RushMiddleware {
	if (!runtime.previewMode) {
		return (context, next) => {
			attachRuntime(context.locals, runtime)
			return next()
		}
	}
	return async (context, next) => {
		const token = context.cookies.get(PREVIEW_COOKIE)?.value
		const session: PreviewSession = { expired: false }
		const scoped =
			token !== undefined && isPreviewToken(token) ? runtime.preview(token, session) : runtime
		attachRuntime(context.locals, scoped)
		const response = withPreviewHeaders(await next())
		if (session.expired) {
			response.headers.append(
				'Set-Cookie',
				previewCookie(hostTrust(context) !== 'loopback', '', 0)
			)
		}
		return response
	}
}

function hasUnknownLocale(urls: RushUrls, params: RouteParams): boolean {
	return params.locale !== undefined && urls.localeOf(params.locale) === undefined
}

export function createRushMiddleware(runtime: RushRuntime): RushMiddleware {
	const handle = runtimeMiddleware(runtime)
	return (context, next) =>
		handle(context, () =>
			hasUnknownLocale(runtime.urls, context.params)
				? Promise.resolve(new Response(null, { status: 404 }))
				: next()
		)
}

function isLoopback(host: string): boolean {
	const candidate = `http://${host.trim()}`
	return URL.canParse(candidate) && LOOPBACK_HOSTS.includes(new URL(candidate).hostname)
}

function claimedHosts(request: Request): string[] {
	const forwarded = request.headers.get('x-forwarded-host')?.split(',') ?? []
	const host = request.headers.get('host')
	return host === null ? forwarded : [host, ...forwarded]
}

function hostTrust(context: PreviewContext): HostTrust {
	if (!LOOPBACK_HOSTS.includes(context.url.hostname)) {
		return 'public'
	}
	return claimedHosts(context.request).every(isLoopback) ? 'loopback' : 'untrusted'
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

function previewCookie(secure: boolean, value: string, maxAge: number): string {
	const flag = secure ? '; Secure' : ''
	return `${PREVIEW_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${flag}`
}

function redirectWithCookie(location: string, cookie: string): Response {
	return seeOther(location, { 'Set-Cookie': cookie, ...PREVIEW_HEADERS })
}

function enterPreview(url: URL, secure: boolean, request: PreviewRequest, path: string): Response {
	const maxAge = request.expiresAt - Math.floor(Date.now() / 1000)
	if (maxAge < 1) {
		return failure(401)
	}
	const target = sameOriginUrl(path, url, url)
	if (target === undefined) {
		return invalidLink()
	}
	return redirectWithCookie(target.href, previewCookie(secure, request.token, maxAge))
}

function previewScope(context: PreviewContext): PreviewScope | Response {
	const runtime = runtimeOf(context.locals)
	if (!runtime.previewMode) {
		return plain(404, 'Not found')
	}
	const trust = hostTrust(context)
	if (trust === 'untrusted') {
		return plain(500, 'Preview host not trusted')
	}
	return { runtime, secure: trust === 'public' }
}

export async function startPreview(context: PreviewContext): Promise<Response> {
	const scope = previewScope(context)
	if (scope instanceof Response) {
		return scope
	}
	const { runtime, secure } = scope
	const request = readPreviewRequest(context.url.searchParams, runtime.urls)
	if (request === undefined) {
		return invalidLink()
	}
	const client = runtime.preview(request.token).onDemandClient()
	try {
		await client.site.get()
		const path = await targetPath(client, runtime.urls, request.target)
		return enterPreview(context.url, secure, request, path)
	} catch (err) {
		if (!isRushError(err)) {
			throw err
		}
		return failure(err.status)
	}
}

export function exitPreview(context: PreviewContext): Response {
	const scope = previewScope(context)
	if (scope instanceof Response) {
		return scope
	}
	const target = sameOriginUrl(context.url.searchParams.get('return'), context.url, context.url)
	return redirectWithCookie(target?.href ?? '/', previewCookie(scope.secure, '', 0))
}
