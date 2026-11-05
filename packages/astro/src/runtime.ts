import { createClient, toBcp47 } from '@rushcms/client'
import type { LocaleCode, RushClient } from '@rushcms/client'
import type { APIContext } from 'astro'
import type { RushSiteConfig } from './config'
import type { RushApiSettings } from './settings'

export type RushContext = Pick<APIContext, 'locals' | 'currentLocale' | 'isPrerendered' | 'params'>

export type RushRuntimeSettings = {
	api: RushApiSettings
	config: RushSiteConfig
}

export type RushRuntime = {
	client(context: RushContext): RushClient
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
	const { api, config } = settings
	const shared = new Map<LocaleCode, RushClient>()

	function create(locale: LocaleCode, memo: boolean): RushClient {
		return createClient({
			...api,
			locale,
			memo,
			routes: config.routes,
			localePaths: config.localePaths
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
		client: (context) => {
			const locale = resolveLocale(config, context.currentLocale ?? context.params.locale)
			return config.memo && context.isPrerendered
				? sharedClient(locale)
				: create(locale, false)
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
	return typeof value === 'object' && value !== null && 'client' in value
}
