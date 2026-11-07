import assert from 'node:assert/strict'
import { join } from 'node:path'
import type { AdminApi } from '../../walk-kit/admin-api.ts'
import { adminLogin } from '../../walk-kit/admin-api.ts'
import type { Redirect, Walker } from '../../walk-kit/browser.ts'
import { launchWalker, redirectsOnce } from '../../walk-kit/browser.ts'
import { PREVIEW_PORT, SITE_PORT } from '../../walk-kit/env.ts'
import { behindProxy, sentWithScript, sentWithoutScript } from '../../walk-kit/form-checks.ts'
import type { ContactForm } from '../../walk-kit/form-checks.ts'
import type { CheckLog } from '../../walk-kit/results.ts'
import { allPassed, recordCheck } from '../../walk-kit/results.ts'
import { SITE_A_LOCALES, SITE_B_LOCALES, createFreshSite, prepareSiteA, withDraft } from './cms.ts'
import type { Draft } from './cms.ts'
import { devPages } from './dev-checks.ts'
import type { DevPage } from './dev-checks.ts'
import { PREVIEW_URL, SITE_URL, readTemplateEnv } from './env.ts'
import type { TemplateEnv } from './env.ts'
import { builtWithoutWarnings, previewDraft, previewOnDemand } from './preview-checks.ts'
import type { PreviewPage } from './preview-checks.ts'
import {
	allowWalkerDomains,
	build,
	localePathsError,
	pasteLocalePaths,
	projectAt,
	runScript,
	servePreviewBuild,
	suggestedLine,
	writeDelivery
} from './project.ts'
import type { Delivery, Project } from './project.ts'
import { projectOf } from './projects.ts'
import type { SiteKey } from './projects.ts'
import {
	FRONT_HEADING,
	collectionPages,
	entryPages,
	frontPages,
	languageSwitch,
	notFoundPages,
	pageChrome,
	sitemapAndRobots,
	textSpacing,
	tokenAbsent
} from './site-checks.ts'
import type {
	EntryPage,
	FrontSite,
	LanguageSwitch,
	ListPage,
	PageChrome,
	RenderedLink,
	SitemapSpec,
	SwitcherLink
} from './site-checks.ts'

type WalkContext = {
	env: TemplateEnv
	walker: Walker
	admin: AdminApi
	log: CheckLog
}

type SiteSetup = {
	delivery: Delivery
	draft: Draft
	restore(): Promise<void>
}

type SitePlan = {
	key: SiteKey
	localeError: string
	localePaths: string
	front: FrontSite
	chrome: PageChrome[]
	lists: ListPage[]
	beyondLists: string[]
	entries: EntryPage[]
	switches: LanguageSwitch[]
	notFound: string[]
	moved: Redirect[]
	sitemap: SitemapSpec
	contact: boolean
	onDemand: PreviewPage
	draft: PreviewPage
	dev: DevPage[]
	setup(context: WalkContext): Promise<SiteSetup>
}

type NamedCheck = {
	name: string
	run(): Promise<string>
}

const SENT = 'Thank you, your message was sent.'
const DEV_NOTICE = 'This notice appears only in <code'
const FORM_MARKUP = 'data-rush-form="contact"'

function link(label: string, href: string): RenderedLink {
	return { label, href, target: null, rel: null, classes: ['nav-link'], track: null }
}

function external(label: string): RenderedLink {
	return {
		label,
		href: 'https://example.com',
		target: '_blank',
		rel: 'noopener',
		classes: ['nav-link'],
		track: null
	}
}

function policy(label: string): RenderedLink {
	return {
		label,
		href: 'https://example.org/policy',
		target: '_blank',
		rel: 'me nofollow noreferrer noopener',
		classes: ['nav-link', 'footer-external'],
		track: 'footer'
	}
}

function switcher(paths: string[], current: number): SwitcherLink[] {
	return ['pt-BR', 'en', 'es'].map((hreflang, index) => ({
		hreflang,
		href: paths[index] ?? null,
		current: index === current ? 'true' : null
	}))
}

const HELLO_PATHS = ['/artigos/ola-mundo', '/en/blog/hello-world', '/es/articulos/hola-mundo']

const HELLO_ALTERNATES = [
	`pt-BR ${SITE_URL}/artigos/ola-mundo`,
	`en ${SITE_URL}/en/blog/hello-world`,
	`es ${SITE_URL}/es/articulos/hola-mundo`,
	`x-default ${SITE_URL}/artigos/ola-mundo`
]

function hello(path: string, lang: string, title: string, locale: string): EntryPage {
	return {
		path,
		lang,
		title,
		alternates: HELLO_ALTERNATES,
		richText: {
			heading: title,
			links: [`https://example.com/${locale}`],
			items: 2,
			images: 1,
			callout: null
		}
	}
}

const MAIN_PT = [
	link('Início', '/'),
	link('Artigos', '/artigos'),
	link('Olá, mundo', '/artigos/ola-mundo'),
	link('Serviços', '/servicos'),
	external('Site externo')
]

const MAIN_EN = [
	link('Home', '/'),
	link('Blog', '/en/blog'),
	link('Hello, world', '/en/blog/hello-world'),
	link('Services', '/en/services'),
	external('External site')
]

const SITE_A: SitePlan = {
	key: 'a',
	localeError:
		'@rushcms/astro: localePaths locales [] differ from the site locales [pt_BR, en, es].',
	localePaths: "localePaths: { pt_BR: '', en: 'en', es: 'es' }",
	front: {
		name: 'SDK E2E',
		pages: [
			{
				path: '/',
				lang: 'pt-BR',
				title: 'SDK E2E (pt_BR)',
				collections: ['/artigos', '/servicos']
			},
			{
				path: '/en',
				lang: 'en',
				title: 'SDK E2E (en)',
				collections: ['/en/blog', '/en/services']
			},
			{
				path: '/es',
				lang: 'es',
				title: 'SDK E2E (es)',
				collections: ['/es/articulos', '/es/servicios']
			}
		]
	},
	chrome: [
		{
			path: '/',
			main: MAIN_PT,
			footer: [policy('Política'), link('Serviços', '/servicos')],
			switcher: switcher(['/', '/en', '/es'], 0)
		},
		{
			path: '/en/blog/hello-world',
			main: MAIN_EN,
			footer: [policy('Policy'), link('Services', '/en/services')],
			switcher: switcher(HELLO_PATHS, 1)
		}
	],
	lists: [
		{ path: '/artigos', entries: 2, previous: null, next: '/artigos/page/2' },
		{ path: '/artigos/page/2', entries: 1, previous: '/artigos', next: null },
		{ path: '/en/blog', entries: 2, previous: null, next: '/en/blog/page/2' },
		{ path: '/en/blog/page/2', entries: 1, previous: '/en/blog', next: null }
	],
	beyondLists: ['/artigos/page/3', '/en/blog/page/3', '/artigos/page/1'],
	entries: [
		hello('/artigos/ola-mundo', 'pt-BR', 'Olá, mundo', 'pt_BR'),
		hello('/en/blog/hello-world', 'en', 'Hello, world', 'en'),
		hello('/es/articulos/hola-mundo', 'es', 'Hola, mundo', 'es')
	],
	switches: [
		{
			from: '/en/blog/hello-world',
			hreflang: 'es',
			to: '/es/articulos/hola-mundo',
			lang: 'es',
			title: 'Hola, mundo'
		}
	],
	notFound: ['/EN/blog/hello-world', '/pt_BR/artigos/ola-mundo', '/EN/', '/pt_BR/'],
	moved: [
		{ from: '/artigos/guia-antigo', to: '/artigos/guia-novo' },
		{ from: '/en/blog/old-guide', to: '/en/blog/new-guide' },
		{ from: '/artigos/hello-world', to: '/artigos/ola-mundo' },
		{ from: '/es/articulos/hello-world', to: '/es/articulos/hola-mundo' }
	],
	sitemap: {
		includes: [
			`${SITE_URL}/`,
			`${SITE_URL}/en`,
			`${SITE_URL}/es`,
			`${SITE_URL}/artigos`,
			`${SITE_URL}/en/blog`,
			`${SITE_URL}/servicos`,
			...HELLO_PATHS.map((path) => `${SITE_URL}${path}`),
			`${SITE_URL}/en/blog/only-in-english`,
			`${SITE_URL}/artigos/guia-novo`
		],
		excludes: ['/page/', '/es/articulos/only-in-english', 'guia-antigo', 'rascunho']
	},
	contact: true,
	onDemand: { path: '/en/blog/hello-world', title: 'Hello, world' },
	draft: { path: '/artigos/rascunho-t9', title: 'Rascunho T9' },
	dev: [
		{ path: '/', status: 200, includes: [FRONT_HEADING, 'lang="pt-BR"'], excludes: [] },
		{ path: '/en', status: 200, includes: [FRONT_HEADING, 'lang="en"'], excludes: [] },
		{ path: '/contact', status: 200, includes: [FORM_MARKUP], excludes: [DEV_NOTICE] }
	],
	setup: async ({ admin, env }) => {
		const content = await prepareSiteA(admin, env.siteId)
		return {
			delivery: { apiUrl: env.apiUrl, siteId: env.siteId, token: env.apiToken },
			draft: {
				siteId: env.siteId,
				collectionId: await admin.collectionId(env.siteId, 'pt_BR', 'artigos'),
				locales: SITE_A_LOCALES,
				locale: 'pt_BR',
				translation: {
					title: 'Rascunho T9',
					slug: 'rascunho-t9',
					excerpt: 'Rascunho',
					data: {}
				}
			},
			restore: () => content.restore()
		}
	}
}

const SITE_B: SitePlan = {
	key: 'b',
	localeError: '@rushcms/astro: localePaths locales [] differ from the site locales [en].',
	localePaths: "localePaths: { en: '' }",
	front: {
		name: 'Fresh T9',
		pages: [{ path: '/', lang: 'en', title: 'Fresh T9', collections: ['/posts'] }]
	},
	chrome: [
		{ path: '/', main: [], footer: [], switcher: [] },
		{ path: '/posts', main: [], footer: [], switcher: [] }
	],
	lists: [{ path: '/posts', entries: 0, previous: null, next: null }],
	beyondLists: ['/posts/page/2'],
	entries: [],
	switches: [],
	notFound: ['/contact', '/en', '/en/posts', '/EN/', '/pt_BR/'],
	moved: [],
	sitemap: {
		includes: [`${SITE_URL}/`, `${SITE_URL}/posts`],
		excludes: ['/en', '/page/', 'first-draft']
	},
	contact: false,
	onDemand: { path: '/', title: FRONT_HEADING },
	draft: { path: '/posts/first-draft', title: 'First draft' },
	dev: [
		{ path: '/', status: 200, includes: [FRONT_HEADING, 'lang="en"'], excludes: [] },
		{ path: '/contact', status: 200, includes: [DEV_NOTICE], excludes: [FORM_MARKUP] }
	],
	setup: async ({ admin, env }) => {
		const fresh = await createFreshSite(admin)
		return {
			delivery: { apiUrl: env.apiUrl, siteId: fresh.siteId, token: fresh.token },
			draft: {
				siteId: fresh.siteId,
				collectionId: fresh.collectionId,
				locales: SITE_B_LOCALES,
				locale: 'en',
				translation: {
					title: 'First draft',
					slug: 'first-draft',
					excerpt: 'Draft',
					data: {}
				}
			},
			restore: () => admin.deleteSite(fresh.siteId)
		}
	}
}

const PLANS: Record<SiteKey, SitePlan> = { a: SITE_A, b: SITE_B }

function contactForm(admin: AdminApi, siteId: string): ContactForm {
	return { admin, siteId, path: '/contact', sentText: SENT }
}

function serverChecks(
	context: WalkContext,
	plan: SitePlan,
	setup: SiteSetup,
	project: Project
): NamedCheck[] {
	const { walker, admin } = context
	const prefix = `${plan.key}-`
	const form = contactForm(admin, setup.delivery.siteId)
	const checks: NamedCheck[] = [
		{ name: 'front page per locale', run: () => frontPages(walker, plan.front, prefix) },
		{
			name: 'header, footer and language switcher',
			run: () => pageChrome(walker, plan.chrome, prefix)
		},
		{
			name: 'collection list and pagination',
			run: () => collectionPages(walker, plan.lists, plan.beyondLists, prefix)
		},
		...(plan.entries.length === 0
			? []
			: [{ name: 'entry per locale', run: () => entryPages(walker, plan.entries, prefix) }]),
		...plan.switches.map((change) => ({
			name: 'language switcher click',
			run: () => languageSwitch(walker, change)
		})),
		...(plan.contact
			? [
					{
						name: 'contact form with JS through the proxy',
						run: () =>
							behindProxy(walker, SITE_PORT, (origin) =>
								sentWithScript(walker, form, origin, `${prefix}form-js`)
							)
					},
					{
						name: 'contact form without JS through the proxy (303)',
						run: () =>
							behindProxy(walker, SITE_PORT, (origin) =>
								sentWithoutScript(walker, form, origin, `${prefix}form-nojs`)
							)
					}
				]
			: []),
		{
			name: 'unknown and code-form locale segments answer 404',
			run: () => notFoundPages(walker, plan.front.name, plan.notFound, prefix)
		},
		...(plan.moved.length === 0
			? []
			: [
					{
						name: 'retired slugs answer 301 on the site',
						run: () =>
							redirectsOnce(walker, SITE_URL, plan.moved, 301, `${prefix}moved`)
					},
					{
						name: 'retired slugs answer 302 on the preview deployment',
						run: () =>
							redirectsOnce(
								walker,
								PREVIEW_URL,
								plan.moved,
								302,
								`${prefix}moved-preview`
							)
					}
				]),
		{ name: 'sitemap.xml and robots.txt', run: () => sitemapAndRobots(SITE_URL, plan.sitemap) },
		{ name: 'preview deployment on demand', run: () => previewOnDemand(walker, plan.onDemand) },
		{
			name: 'preview link -> cookie -> draft -> exit',
			run: () =>
				withDraft(admin, setup.draft, (link) =>
					previewDraft(walker, link, plan.draft, `${prefix}preview`)
				)
		},
		{
			name: 'delivery token absent from the client bundles',
			run: () => tokenAbsent(project, setup.delivery.token)
		},
		{ name: 'built pages keep the spaces in their text', run: () => textSpacing(project) }
	]
	return checks
}

async function firstRun(project: Project, plan: SitePlan): Promise<string> {
	const output = await localePathsError(project)
	assert.ok(output.includes(plan.localeError), `the first run names the locales:\n${output}`)
	const line = suggestedLine(output)
	assert.equal(line, plan.localePaths)
	pasteLocalePaths(project, line)
	allowWalkerDomains(project)
	return `${project.manager} run dev stops with "${plan.localeError}" and suggests ${line}; pasted over localePaths: {} in astro.config.ts (allowedDomains set to localhost and the walker proxy host)`
}

async function serveAndCheck(
	context: WalkContext,
	plan: SitePlan,
	setup: SiteSetup,
	project: Project
): Promise<void> {
	const site = runScript(project, 'preview', { PORT: String(SITE_PORT) })
	const preview = servePreviewBuild(project, PREVIEW_PORT)
	try {
		await site.untilAnswering(SITE_URL)
		await preview.untilAnswering(PREVIEW_URL)
		for (const check of serverChecks(context, plan, setup, project)) {
			await recordCheck(context.log, check.name, () => check.run())
		}
	} finally {
		await site.stop()
		await preview.stop()
	}
}

async function walkSite(context: WalkContext, plan: SitePlan): Promise<void> {
	const project = projectAt(context.env.workDir, projectOf(plan.key))
	const setup = await plan.setup(context)
	try {
		writeDelivery(project, setup.delivery)
		const first = await recordCheck(context.log, 'first run prints the localePaths line', () =>
			firstRun(project, plan)
		)
		const site = await recordCheck(context.log, 'production build', async () =>
			builtWithoutWarnings(await build(project, false), false)
		)
		const preview = await recordCheck(
			context.log,
			'preview build (RUSH_PREVIEW=true) without getStaticPaths warnings',
			async () => builtWithoutWarnings(await build(project, true), true)
		)
		if ([first, site, preview].every((result) => result.status === 'PASS')) {
			await serveAndCheck(context, plan, setup, project)
			await recordCheck(context.log, 'astro dev', () => devPages(project, plan.dev))
		}
	} finally {
		await setup.restore()
	}
}

function isSiteKey(value: string): value is SiteKey {
	return Object.hasOwn(PLANS, value)
}

const keys = process.argv.slice(2)
if (keys.length === 0 || !keys.every(isSiteKey)) {
	console.error(`usage: walk <${Object.keys(PLANS).join('|')}>...`)
	process.exit(2)
}

const env = readTemplateEnv()
const walker = await launchWalker(env.chromePath, env.shotsDir)
try {
	const admin = await adminLogin(env.apiUrl, env.adminEmail, env.adminPassword)
	const log: CheckLog = {
		path: join(env.shotsDir, `results-template-${keys.join('-')}.json`),
		results: []
	}
	for (const key of keys) {
		await walkSite({ env, walker, admin, log }, PLANS[key])
	}
	process.exitCode = allPassed(log) ? 0 : 1
} finally {
	await walker.close()
}
