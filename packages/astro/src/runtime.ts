import { createClient, createUrls, toBcp47 } from '@rushcms/client'
import type { LocaleCode, Perspective, RushClient, RushFetch, RushUrls } from '@rushcms/client'
import type { APIContext, AstroRuntimeLogger } from 'astro'
import type { RushSiteConfig, SeoFieldMap } from './config'
import { fallbackFetch } from './preview-session'
import type { PreviewSession } from './preview-session'
import type { RushApiSettings } from './settings'

export type RushContext = Pick<
	APIContext,
	'locals' | 'currentLocale' | 'isPrerendered' | 'params' | 'url'
>

export type RushRuntimeSettings = {
	api: RushApiSettings
	config: RushSiteConfig
	perspective?: Perspective
	fetch?: RushFetch
	session?: PreviewSession
	warned?: Set<string>
}

export type RushRuntime = {
	readonly previewMode: boolean
	readonly previewActive: boolean
	readonly defaultLocale: LocaleCode
	readonly trustedProxies: number
	readonly seo: Readonly<Record<string, SeoFieldMap>>
	readonly urls: RushUrls
	locale(context: RushContext): LocaleCode
	client(context: RushContext): RushClient
	clientIn(context: RushContext, locale: LocaleCode): RushClient
	onDemandClient(): RushClient
	preview(token: string, fallback?: PreviewSession): RushRuntime
	warnOnce(logger: AstroRuntimeLogger, message: string): void
}

const RUNTIME_KEY = Symbol.for('@rushcms/astro:runtime')

function normalized(code: string): string {
	return toBcp47(code).toLowerCase()
}

export type LocaleRequest = {
	segment: string | undefined
	current: string | undefined
	path: string | undefined
}

const NO_LOCALE: LocaleRequest = { segment: undefined, current: undefined, path: undefined }

function matchLocale(urls: RushUrls, requested: string): LocaleCode | undefined {
	return (
		urls.localeOf(requested) ??
		urls.locales.find((locale) => normalized(locale) === normalized(requested))
	)
}

export function localeRequest(
	context: RushContext,
	segment: string | undefined = context.params.locale
): LocaleRequest {
	return { segment, current: context.currentLocale, path: context.url.pathname }
}

function pathLocale(urls: RushUrls, path: string | undefined): LocaleCode | undefined {
	if (path === undefined) {
		return undefined
	}
	const first = path.split('/').find((part) => part !== '')
	return urls.match(path)?.locale ?? (first === undefined ? undefined : urls.localeOf(first))
}

export function findLocale(
	urls: RushUrls,
	defaultLocale: LocaleCode,
	request: LocaleRequest
): LocaleCode | undefined {
	if (request.segment !== undefined) {
		return urls.localeOf(request.segment)
	}
	if (request.current !== undefined) {
		return matchLocale(urls, request.current)
	}
	return pathLocale(urls, request.path) ?? urls.localeOf(undefined) ?? defaultLocale
}

export function resolveLocale(
	urls: RushUrls,
	defaultLocale: LocaleCode,
	request: LocaleRequest
): LocaleCode {
	const locale = findLocale(urls, defaultLocale, request)
	if (locale === undefined) {
		throw new Error(
			`@rushcms/astro: locale "${request.segment ?? request.current}" matches no localePaths entry`
		)
	}
	return locale
}

export function createRushRuntime(settings: RushRuntimeSettings): RushRuntime {
	const { api, config, perspective, fetch, session } = settings
	const warned = settings.warned ?? new Set<string>()
	const shareable = config.memo && !config.preview
	const shared = new Map<LocaleCode, RushClient>()

	function create(locale: LocaleCode, memo: boolean): RushClient {
		return createClient({
			...api,
			locale,
			memo,
			routes: config.routes,
			localePaths: config.localePaths,
			...(perspective === undefined ? {} : { perspective }),
			...(fetch === undefined ? {} : { fetch })
		})
	}

	function sharedClient(locale: LocaleCode): RushClient {
		const existing = shared.get(locale)
		if (existing !== undefined) {
			return existing
		}
		const client = create(locale, true)
		shared.set(locale, client)
		return client
	}

	const urls = createUrls(config)

	function clientIn(context: RushContext, locale: LocaleCode): RushClient {
		return shareable && context.isPrerendered ? sharedClient(locale) : create(locale, false)
	}

	function locale(context: RushContext): LocaleCode {
		return resolveLocale(urls, config.defaultLocale, localeRequest(context))
	}

	return {
		previewMode: config.preview,
		get previewActive() {
			return config.preview && perspective === 'draft' && session?.expired !== true
		},
		defaultLocale: config.defaultLocale,
		trustedProxies: config.trustedProxies,
		seo: config.seo,
		urls,
		locale,
		client: (context) => clientIn(context, locale(context)),
		clientIn,
		onDemandClient: () => create(resolveLocale(urls, config.defaultLocale, NO_LOCALE), false),
		preview: (token, fallback) =>
			createRushRuntime({
				api: { ...api, token },
				config,
				perspective: 'draft',
				warned,
				...(fallback === undefined
					? {}
					: { fetch: fallbackFetch(api.token, fallback), session: fallback })
			}),
		warnOnce: (logger, message) => {
			if (!warned.has(message)) {
				warned.add(message)
				logger.warn(message)
			}
		}
	}
}

export function attachRuntime(locals: object, runtime: RushRuntime): void {
	Reflect.set(locals, RUNTIME_KEY, runtime)
}

export function runtimeOf(locals: object): RushRuntime {
	const runtime: unknown = Reflect.get(locals, RUNTIME_KEY)
	if (!isRuntime(runtime)) {
		throw new Error(
			'@rushcms/astro: the rush() integration middleware did not run for this request'
		)
	}
	return runtime
}

function isRuntime(value: unknown): value is RushRuntime {
	return typeof value === 'object' && value !== null && 'onDemandClient' in value
}
