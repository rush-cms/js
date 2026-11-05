import { createClient, createUrls, toBcp47 } from '@rushcms/client'
import type { LocaleCode, Perspective, RushClient, RushFetch, RushUrls } from '@rushcms/client'
import type { APIContext } from 'astro'
import type { RushSiteConfig } from './config'
import { fallbackFetch } from './preview-session'
import type { PreviewSession } from './preview-session'
import type { RushApiSettings } from './settings'

export type RushContext = Pick<APIContext, 'locals' | 'currentLocale' | 'isPrerendered' | 'params'>

export type RushRuntimeSettings = {
	api: RushApiSettings
	config: RushSiteConfig
	perspective?: Perspective
	fetch?: RushFetch
}

export type RushRuntime = {
	readonly previewMode: boolean
	readonly urls: RushUrls
	client(context: RushContext): RushClient
	onDemandClient(): RushClient
	preview(token: string, fallback?: PreviewSession): RushRuntime
}

const RUNTIME_KEY = Symbol.for('@rushcms/astro:runtime')

function normalized(code: string): string {
	return toBcp47(code).toLowerCase()
}

export function resolveLocale(config: RushSiteConfig, requested: string | undefined): LocaleCode {
	const entries = Object.entries(config.localePaths)
	if (requested === undefined) {
		return entries.find(([, prefix]) => prefix === '')?.[0] ?? config.defaultLocale
	}
	const match = entries.find(
		([locale, prefix]) => prefix === requested || normalized(locale) === normalized(requested)
	)
	if (match === undefined) {
		throw new Error(`@rushcms/astro: locale "${requested}" matches no localePaths entry`)
	}
	return match[0]
}

export function createRushRuntime(settings: RushRuntimeSettings): RushRuntime {
	const { api, config, perspective, fetch } = settings
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

	return {
		previewMode: config.preview,
		urls: createUrls(config),
		client: (context) => {
			const locale = resolveLocale(config, context.currentLocale ?? context.params.locale)
			return shareable && context.isPrerendered ? sharedClient(locale) : create(locale, false)
		},
		onDemandClient: () => create(resolveLocale(config, undefined), false),
		preview: (token, fallback) =>
			createRushRuntime({
				api: { ...api, token },
				config,
				perspective: 'draft',
				...(fallback === undefined ? {} : { fetch: fallbackFetch(api.token, fallback) })
			})
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
