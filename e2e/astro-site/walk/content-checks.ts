import assert from 'node:assert/strict'
import type { Page } from 'puppeteer-core'
import { entryRequestsDuring } from './api-log.ts'
import type { LoggedRequest } from './api-log.ts'
import type { Walker } from './browser.ts'
import { hopsOf } from './browser.ts'
import { PREVIEW_URL, SITE_URL } from './env.ts'
import type { WalkEnv } from './env.ts'
import { publicClient } from './public-api.ts'

type LocalizedEntry = {
	locale: string
	path: string
	collection: string
	slug: string
	heading: string
}

type RenderedRichText = {
	heading: string | null
	links: (string | null)[]
	items: number
	images: number
	callout: string | null
}

type RenderedImage = {
	src: string
	width: number
	height: number
	alt: string
	loaded: boolean
}

const HELLO: LocalizedEntry[] = [
	{
		locale: 'pt_BR',
		path: '/pt/artigos/ola-mundo',
		collection: 'artigos',
		slug: 'ola-mundo',
		heading: 'Olá, mundo'
	},
	{
		locale: 'en',
		path: '/en/blog/hello-world',
		collection: 'blog',
		slug: 'hello-world',
		heading: 'Hello, world'
	},
	{
		locale: 'es',
		path: '/es/articulos/hola-mundo',
		collection: 'articulos',
		slug: 'hola-mundo',
		heading: 'Hola, mundo'
	}
]

const MOVED_FROM = '/pt/artigos/hello-world'
const MOVED_TO = '/pt/artigos/ola-mundo'

function entryPathOf(env: WalkEnv, collection: string, slug: string): string {
	return `/api/v1/${env.siteId}/collections/${collection}/entries/${slug}`
}

async function loadedImages(page: Page, selector: string): Promise<boolean[]> {
	return page.$$eval(selector, (images) =>
		Promise.all(
			images.map((image) => {
				if (!(image instanceof HTMLImageElement)) {
					return Promise.resolve(false)
				}
				image.loading = 'eager'
				return image.decode().then(
					() => image.naturalWidth > 0,
					() => false
				)
			})
		)
	)
}

async function richText(page: Page): Promise<RenderedRichText> {
	const loaded = await loadedImages(page, '[data-field="body"] img')
	const rendered = await page.$eval('[data-field="body"]', (body) => ({
		heading: body.querySelector('h2')?.textContent ?? null,
		links: [...body.querySelectorAll('a')].map((link) => link.getAttribute('href')),
		items: body.querySelectorAll('ul > li').length,
		callout: body.querySelector('[data-callout]')?.textContent ?? null
	}))
	return { ...rendered, images: loaded.filter(Boolean).length }
}

async function featured(page: Page): Promise<RenderedImage> {
	const [loaded = false] = await loadedImages(page, '[data-featured] img')
	const rendered = await page.$eval('[data-featured] img', (image) => ({
		src: image.getAttribute('src') ?? '',
		width: image.width,
		height: image.height,
		alt: image.alt
	}))
	return { ...rendered, loaded }
}

async function open(page: Page, url: string): Promise<void> {
	const response = await page.goto(url, { waitUntil: 'load' })
	assert.equal(response?.status(), 200, `GET ${url}`)
}

function assertRichText(rendered: RenderedRichText, entry: LocalizedEntry): void {
	assert.deepEqual(rendered, {
		heading: entry.heading,
		links: [`https://example.com/${entry.locale}`],
		items: 2,
		images: 1,
		callout: `Callout (${entry.locale})`
	})
}

export function richTextInEachLocale(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		const shots: string[] = []
		for (const entry of HELLO) {
			await open(page, `${SITE_URL}${entry.path}`)
			assertRichText(await richText(page), entry)
			shots.push(await walker.shot(page, `15-rich-text-${entry.locale}`))
		}
		return `${HELLO.map((entry) => entry.path).join(', ')}: h2, link https://example.com/<locale>, 2 list items, loaded image, callout block "Callout (<locale>)" [${shots.join(', ')}]`
	})
}

export function featuredImage(walker: Walker, env: WalkEnv): Promise<string> {
	return walker.withPage(async (page) => {
		const entry = await publicClient(env).entries.get('artigos', 'ola-mundo', {
			locale: 'pt_BR'
		})
		const media = entry.featured_image
		assert.ok(media, 'the entry has a featured image')
		assert.ok(media.width && media.height, 'the featured image has dimensions')
		const { url } = media
		assert.ok(url, 'the featured image has a url')
		const master = await fetch(url)
		assert.equal(master.status, 200, `GET ${url}`)
		const type = master.headers.get('content-type') ?? ''
		await master.body?.cancel()
		assert.ok(type.startsWith('image/'), `media content type ${type}`)
		await open(page, `${SITE_URL}${MOVED_TO}`)
		const rendered = await featured(page)
		assert.ok(rendered.src.startsWith('/_astro/'), `optimized src ${rendered.src}`)
		assert.deepEqual(
			{ ...rendered, src: '' },
			{
				src: '',
				width: media.width,
				height: media.height,
				alt: media.alt ?? '',
				loaded: true
			}
		)
		const shot = await walker.shot(page, '16-featured-image')
		return `media ${url} -> 200 ${type} ${media.width}x${media.height}; RushImage <img src=${rendered.src} ${rendered.width}x${rendered.height} alt="${rendered.alt}"> loaded [${shot}]`
	})
}

export function previewOnDemand(walker: Walker): Promise<string> {
	return walker.withPage(async (page) => {
		const [entry] = HELLO
		assert.ok(entry)
		const response = await page.goto(`${PREVIEW_URL}${entry.path}`, { waitUntil: 'load' })
		assert.equal(response?.status(), 200)
		assert.equal(response.headers()['x-robots-tag'], 'noindex')
		assert.equal(await page.$('[data-rush-preview]'), null)
		assertRichText(await richText(page), entry)
		const rendered = await featured(page)
		assert.ok(rendered.loaded, `featured image ${rendered.src} loaded`)
		const shot = await walker.shot(page, '17-preview-on-demand')
		return `${PREVIEW_URL}${entry.path} (every route on demand, no props) -> 200 noindex via resolveEntry, rich text + callout, featured ${rendered.src} loaded [${shot}]`
	})
}

function describeRequests(requests: LoggedRequest[]): string {
	return requests.map((request) => `${request.path} ${request.status}`).join(', ')
}

async function movedOn(
	walker: Walker,
	env: WalkEnv,
	base: string,
	expected: LoggedRequest[]
): Promise<string> {
	return walker.withPage(async (page) => {
		const requests = await entryRequestsDuring(env, async () => {
			const response = await page.goto(`${base}${MOVED_FROM}`)
			assert.ok(response, `no response for ${MOVED_FROM}`)
			assert.deepEqual(hopsOf(response), [
				{ status: 301, path: MOVED_FROM },
				{ status: 200, path: MOVED_TO }
			])
		})
		assert.deepEqual(requests, expected)
		return `${base}${MOVED_FROM} -301-> ${MOVED_TO}; API entry requests: ${describeRequests(requests)}`
	})
}

export async function movedWithoutRefetch(walker: Walker, env: WalkEnv): Promise<string> {
	const moved: LoggedRequest = { path: entryPathOf(env, 'artigos', 'hello-world'), status: 404 }
	const target: LoggedRequest = { path: entryPathOf(env, 'artigos', 'ola-mundo'), status: 200 }
	const site = await movedOn(walker, env, SITE_URL, [moved])
	const preview = await movedOn(walker, env, PREVIEW_URL, [moved, target])
	return `static catch-all: ${site}; preview page: ${preview} (the 200 is the target page render, no lookup of the moved target)`
}
