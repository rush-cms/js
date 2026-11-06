import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AdminApi } from './admin-api.ts'
import { adminLogin } from './admin-api.ts'
import type { Walker } from './browser.ts'
import { launchWalker } from './browser.ts'
import { turnstileFails, turnstilePasses, useAlwaysPassSecret } from './captcha-checks.ts'
import {
	featuredImage,
	movedWithoutRefetch,
	previewOnDemand,
	richTextInEachLocale
} from './content-checks.ts'
import { readWalkEnv } from './env.ts'
import { fixedRouteOnPreview, fixedRouteOnSite } from './fixed-route-checks.ts'
import type { WalkEnv } from './env.ts'
import {
	formWithScript,
	formWithoutScript,
	visitorIpBehindProxy,
	visitorRateLimit
} from './form-checks.ts'
import { previewFromAdmin } from './preview-checks.ts'
import type { CheckResult } from './results.ts'
import { runCheck } from './results.ts'
import {
	fallbackCanonical,
	languageSwitcher,
	movedRedirects,
	servicesOrder
} from './site-checks.ts'

type WalkContext = {
	env: WalkEnv
	walker: Walker
	admin: AdminApi
}

type Check = {
	name: string
	run(context: WalkContext): Promise<string>
}

type Group = 'site' | 'preview' | 'captcha'

type GroupPlan = {
	prepare?(context: WalkContext): Promise<void>
	checks: Check[]
}

const GROUPS: Record<Group, GroupPlan> = {
	site: {
		checks: [
			{ name: 'language switcher + hreflang', run: ({ walker }) => languageSwitcher(walker) },
			{ name: 'fallback page + canonical', run: ({ walker }) => fallbackCanonical(walker) },
			{ name: '301 from moved slugs/segments', run: ({ walker }) => movedRedirects(walker) },
			{ name: 'services order + tag page', run: ({ walker }) => servicesOrder(walker) },
			{
				name: 'fixed-collection route in pt/en/es',
				run: ({ walker }) => fixedRouteOnSite(walker)
			},
			{ name: 'rich text in each locale', run: ({ walker }) => richTextInEachLocale(walker) },
			{
				name: 'featured image via RushImage',
				run: ({ walker, env }) => featuredImage(walker, env)
			},
			{
				name: 'form with JS',
				run: ({ walker, admin, env }) => formWithScript(walker, admin, env.siteId)
			},
			{
				name: 'form without JS (303)',
				run: ({ walker, admin, env }) => formWithoutScript(walker, admin, env.siteId)
			},
			{
				name: 'visitor IP behind proxy',
				run: ({ walker, admin, env }) => visitorIpBehindProxy(walker, admin, env.siteId)
			},
			{
				name: '429 after the visitor limit',
				run: ({ walker, env }) => visitorRateLimit(walker, env)
			}
		]
	},
	preview: {
		checks: [
			{ name: 'preview deployment on demand', run: ({ walker }) => previewOnDemand(walker) },
			{
				name: 'fixed-collection route on demand (en, 302)',
				run: ({ walker }) => fixedRouteOnPreview(walker)
			},
			{
				name: 'moved redirect without refetch',
				run: ({ walker, env }) => movedWithoutRefetch(walker, env)
			},
			{
				name: 'preview from the admin button + exit',
				run: ({ walker, env }) => previewFromAdmin(walker, env)
			}
		]
	},
	captcha: {
		prepare: ({ admin, env }) => useAlwaysPassSecret(admin, env.captchaSiteId),
		checks: [
			{ name: 'Turnstile pass', run: ({ walker }) => turnstilePasses(walker) },
			{
				name: 'Turnstile fail',
				run: ({ walker, admin, env }) => turnstileFails(walker, admin, env.captchaSiteId)
			}
		]
	}
}

function isGroup(value: string): value is Group {
	return Object.hasOwn(GROUPS, value)
}

async function walk(context: WalkContext, groups: Group[]): Promise<boolean> {
	const resultsPath = join(context.env.shotsDir, `results-${groups.join('-')}.json`)
	const results: CheckResult[] = []
	for (const group of groups) {
		await GROUPS[group].prepare?.(context)
		for (const check of GROUPS[group].checks) {
			const result = await runCheck(check.name, () => check.run(context))
			console.log(`${result.status} ${result.name}: ${result.evidence}`)
			results.push(result)
			writeFileSync(resultsPath, JSON.stringify(results, null, '\t'))
		}
	}
	return results.every((result) => result.status === 'PASS')
}

const groups = process.argv.slice(2)
if (groups.length === 0 || !groups.every(isGroup)) {
	console.error(`usage: walk <${Object.keys(GROUPS).join('|')}>...`)
	process.exit(2)
}

const env = readWalkEnv()
const walker = await launchWalker(env.chromePath, env.shotsDir)
try {
	const admin = await adminLogin(env.apiUrl, env.adminEmail, env.adminPassword)
	process.exitCode = (await walk({ env, walker, admin }, groups)) ? 0 : 1
} finally {
	await walker.close()
}
