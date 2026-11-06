import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AdminApi } from './admin-api.ts'
import { adminLogin } from './admin-api.ts'
import type { Walker } from './browser.ts'
import { launchWalker } from './browser.ts'
import { turnstileFails, turnstilePasses } from './captcha-checks.ts'
import { readWalkEnv } from './env.ts'
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

const GROUPS: Record<Group, Check[]> = {
	site: [
		{ name: 'language switcher + hreflang', run: ({ walker }) => languageSwitcher(walker) },
		{ name: 'fallback page + canonical', run: ({ walker }) => fallbackCanonical(walker) },
		{ name: '301 from moved slugs/segments', run: ({ walker }) => movedRedirects(walker) },
		{ name: 'services order + tag page', run: ({ walker }) => servicesOrder(walker) },
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
		{ name: '429 after the visitor limit', run: ({ walker }) => visitorRateLimit(walker) }
	],
	preview: [
		{
			name: 'preview from the admin button + exit',
			run: ({ walker, env }) => previewFromAdmin(walker, env)
		}
	],
	captcha: [
		{ name: 'Turnstile pass', run: ({ walker }) => turnstilePasses(walker) },
		{
			name: 'Turnstile fail',
			run: ({ walker, admin, env }) => turnstileFails(walker, admin, env.captchaSiteId)
		}
	]
}

function isGroup(value: string): value is Group {
	return Object.hasOwn(GROUPS, value)
}

const groups = process.argv.slice(2)
if (groups.length === 0 || !groups.every(isGroup)) {
	console.error(`usage: walk <${Object.keys(GROUPS).join('|')}>...`)
	process.exit(2)
}

const env = readWalkEnv()
const walker = await launchWalker(env.chromePath, env.shotsDir)
const admin = await adminLogin(env.apiUrl, env.adminEmail, env.adminPassword)
const results: CheckResult[] = []
try {
	for (const check of groups.flatMap((group) => GROUPS[group])) {
		const result = await runCheck(check.name, () => check.run({ env, walker, admin }))
		console.log(`${result.status} ${result.name}: ${result.evidence}`)
		results.push(result)
	}
} finally {
	await walker.close()
}
writeFileSync(
	join(env.shotsDir, `results-${groups.join('-')}.json`),
	JSON.stringify(results, null, '\t')
)
process.exitCode = results.every((result) => result.status === 'PASS') ? 0 : 1
