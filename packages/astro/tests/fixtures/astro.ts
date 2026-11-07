import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isRecord } from '@rushcms/client/internal'
import type {
	AstroIntegration,
	AstroIntegrationMiddleware,
	HookParameters,
	InjectedRoute,
	RouteOptions
} from 'astro'
import { CONFIG_PLUGIN_NAME, VIRTUAL_CONFIG_ID } from '../../src/config'
import type { RushConfigPlugin, RushSiteConfig } from '../../src/config'
import type { RushCommand } from '../../src/env'

export type ConfigUpdate = Parameters<HookParameters<'astro:config:setup'>['updateConfig']>[0]

export type SetupResult = {
	updates: ConfigUpdate[]
	routes: InjectedRoute[]
	middlewares: AstroIntegrationMiddleware[]
	plugin: RushConfigPlugin
}

export type ProjectDir = {
	root: URL
	remove(): void
}

export function projectWithEnv(env: Record<string, string>): ProjectDir {
	const dir = mkdtempSync(join(tmpdir(), 'rush-astro-'))
	writeFileSync(
		join(dir, '.env'),
		Object.entries(env)
			.map(([name, value]) => `${name}=${value}`)
			.join('\n')
	)
	return {
		root: pathToFileURL(`${dir}/`),
		remove: () => rmSync(dir, { recursive: true, force: true })
	}
}

function isRushPlugin(value: unknown): value is RushConfigPlugin {
	return isRecord(value) && value.name === CONFIG_PLUGIN_NAME
}

function hook<H extends keyof AstroIntegration['hooks']>(
	integration: AstroIntegration,
	name: H
): (params: HookParameters<H>) => unknown {
	const fn = integration.hooks[name]
	if (fn === undefined) {
		throw new Error(`integration has no ${name} hook`)
	}
	return fn as (params: HookParameters<H>) => unknown
}

export async function runSetup(
	integration: AstroIntegration,
	root: URL,
	command: RushCommand = 'build'
): Promise<SetupResult> {
	const updates: ConfigUpdate[] = []
	const routes: InjectedRoute[] = []
	const middlewares: AstroIntegrationMiddleware[] = []
	const params = {
		config: { root, vite: {} },
		command,
		updateConfig: (update: ConfigUpdate) => {
			updates.push(update)
		},
		injectRoute: (route: InjectedRoute) => {
			routes.push(route)
		},
		addMiddleware: (middleware: AstroIntegrationMiddleware) => {
			middlewares.push(middleware)
		}
	}
	await hook(
		integration,
		'astro:config:setup'
	)(params as unknown as HookParameters<'astro:config:setup'>)
	const plugin = updates.flatMap((update) => update.vite?.plugins ?? []).find(isRushPlugin)
	if (plugin === undefined) {
		throw new Error('the config plugin was not registered')
	}
	return { updates, routes, middlewares, plugin }
}

export type StartHook = 'astro:build:start' | 'astro:server:setup'

export async function runStartHook(integration: AstroIntegration, name: StartHook): Promise<void> {
	await hook(integration, name)({} as HookParameters<StartHook>)
}

export async function runRouteSetup(
	integration: AstroIntegration,
	route: RouteOptions
): Promise<void> {
	await hook(integration, 'astro:route:setup')({ route } as HookParameters<'astro:route:setup'>)
}

export async function loadVirtualConfig(plugin: RushConfigPlugin): Promise<RushSiteConfig> {
	const id = plugin.resolveId(VIRTUAL_CONFIG_ID)
	const code = id === undefined ? undefined : await plugin.load(id)
	const prefix = 'export default '
	if (code === undefined || !code.startsWith(prefix)) {
		throw new Error(`${VIRTUAL_CONFIG_ID} did not load`)
	}
	return JSON.parse(code.slice(prefix.length)) as RushSiteConfig
}
