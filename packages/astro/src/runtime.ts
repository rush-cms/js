import { createClient, toBcp47 } from '@rushcms/client'
import type { LocaleCode, RushClient } from '@rushcms/client'
import type { APIContext } from 'astro'
import type { RushSiteConfig } from './config'
import type { RushApiSettings } from './settings'

export type RushContext = Pick<APIContext, 'locals' | 'currentLocale' | 'isPrerendered'>

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

export function resolveLocale(
	config: RushSiteConfig,
	currentLocale: string | undefined
): LocaleCode {
	const entries = Object.entries(config.localePaths)
	const match =
		currentLocale === undefined
			? undefined
			: entries.find(
					([locale, prefix]) =>
						prefix === currentLocale || normalized(locale) === normalized(currentLocale)
				)
	const unprefixed = entries.find(([, prefix]) => prefix === '')
	return (match ?? unprefixed)?.[0] ?? config.defaultLocale
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
			const locale = resolveLocale(config, context.currentLocale)
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
