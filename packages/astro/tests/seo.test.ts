import { describe, expect, it } from 'vitest'
import Seo from '../src/components/seo.astro'
import type { SeoFieldMap } from '../src/config'
import { entryExample, homepageExample } from '../../client/tests/fixtures/contract'
import { linkHrefs, metaContent, renderComponent } from './fixtures/render'
import { rushLocals, siteConfig } from './fixtures/runtime'

const LOCALE_PATHS = { pt_BR: 'pt', en: 'en', es: 'es' }
const API = { url: 'http://127.0.0.1:1', siteId: 'site', token: 'token' }

function localesFor(seo: Record<string, SeoFieldMap> = {}, defaultLocale = 'en'): object {
	return rushLocals(API, siteConfig({ seo, defaultLocale, localePaths: LOCALE_PATHS }))
}

function entryWith(data: Record<string, unknown>) {
	return { ...entryExample(), data }
}

describe('Seo for an entry', () => {
	it('defaults to title, excerpt and featured image with its dimensions', async () => {
		const entry = entryExample()
		const html = await renderComponent(Seo, { props: { entry }, locals: localesFor() })
		expect(html).toContain(`<title>${entry.title}</title>`)
		expect(metaContent(html, 'name', 'description')).toEqual([entry.excerpt])
		expect(metaContent(html, 'property', 'og:title')).toEqual([entry.title])
		expect(metaContent(html, 'property', 'og:description')).toEqual([entry.excerpt])
		expect(metaContent(html, 'property', 'og:image')).toEqual([entry.featured_image?.url])
		expect(metaContent(html, 'property', 'og:image:width')).toEqual([
			String(entry.featured_image?.width)
		])
		expect(metaContent(html, 'property', 'og:image:height')).toEqual([
			String(entry.featured_image?.height)
		])
		expect(metaContent(html, 'property', 'og:type')).toEqual(['article'])
	})

	it('maps title, description and image from data fields of the collection', async () => {
		const entry = {
			...entryWith({
				headline: 'Mapped title',
				summary: 'Mapped summary',
				cover: 'https://cdn.example.com/cover/master'
			}),
			media: {
				cover: { url: 'https://cdn.example.com/cover/master', width: 640, height: 480 }
			}
		}
		const seo = { blog: { title: 'headline', description: 'summary', image: 'cover' } }
		const html = await renderComponent(Seo, { props: { entry }, locals: localesFor(seo) })
		expect(html).toContain('<title>Mapped title</title>')
		expect(metaContent(html, 'name', 'description')).toEqual(['Mapped summary'])
		expect(metaContent(html, 'property', 'og:image')).toEqual([
			'https://cdn.example.com/cover/master'
		])
		expect(metaContent(html, 'property', 'og:image:width')).toEqual(['640'])
		expect(metaContent(html, 'property', 'og:image:height')).toEqual(['480'])
	})

	it('keys the mapping by any locale collection slug or id and falls back per field', async () => {
		const entry = entryWith({ headline: '   ', summary: 'From artigos' })
		const html = await renderComponent(Seo, {
			props: { entry },
			locals: localesFor({ artigos: { title: 'headline', description: 'summary' } })
		})
		expect(html).toContain(`<title>${entry.title}</title>`)
		expect(metaContent(html, 'name', 'description')).toEqual(['From artigos'])
		const byId = await renderComponent(Seo, {
			props: { entry },
			locals: localesFor({ [entry.collection.id]: { description: 'summary' } })
		})
		expect(metaContent(byId, 'name', 'description')).toEqual(['From artigos'])
	})

	it('uses an unsized mapped image url as is and resolves a relative one against the site', async () => {
		const entry = entryWith({ cover: '/uploads/cover.png' })
		const html = await renderComponent(Seo, {
			props: { entry },
			locals: localesFor({ blog: { image: 'cover' } })
		})
		expect(metaContent(html, 'property', 'og:image')).toEqual([
			'https://site.example/uploads/cover.png'
		])
		expect(metaContent(html, 'property', 'og:image:width')).toEqual([])
	})

	it('omits tags it has no value for', async () => {
		const entry = entryExample()
		delete entry.excerpt
		delete entry.featured_image
		const html = await renderComponent(Seo, { props: { entry }, locals: localesFor() })
		expect(metaContent(html, 'name', 'description')).toEqual([])
		expect(metaContent(html, 'property', 'og:image')).toEqual([])
	})

	it('escapes text', async () => {
		const entry = { ...entryExample(), title: 'A "quoted" <b>title</b>' }
		const html = await renderComponent(Seo, { props: { entry }, locals: localesFor() })
		expect(html).toContain('<title>A &quot;quoted&quot; &lt;b&gt;title&lt;/b&gt;</title>')
		expect(metaContent(html, 'property', 'og:title')).toEqual([
			'A &quot;quoted&quot; <b>title</b>'
		])
	})

	it('points canonical at itself and lists hreflang alternates with x-default', async () => {
		const html = await renderComponent(Seo, {
			props: { entry: entryExample() },
			locals: localesFor()
		})
		expect(linkHrefs(html, 'canonical')).toEqual(['https://site.example/pt/artigos/ola-mundo'])
		expect(html).toContain(
			'<link rel="alternate" hreflang="pt-BR" href="https://site.example/pt/artigos/ola-mundo">'
		)
		expect(html).toContain(
			'<link rel="alternate" hreflang="en" href="https://site.example/en/blog/hello-world">'
		)
		expect(html).toContain(
			'<link rel="alternate" hreflang="es" href="https://site.example/es/articulos/hola-mundo">'
		)
		expect(html).toContain(
			'<link rel="alternate" hreflang="x-default" href="https://site.example/en/blog/hello-world">'
		)
		expect(metaContent(html, 'property', 'og:locale')).toEqual(['pt-BR'])
		expect(metaContent(html, 'property', 'og:locale:alternate')).toEqual(['en', 'es'])
	})

	it('omits x-default when the default locale has no translation', async () => {
		const entry = entryExample()
		delete entry.translations.en
		const html = await renderComponent(Seo, { props: { entry }, locals: localesFor() })
		expect(html).not.toContain('x-default')
	})

	it('points canonical at the original translation when the page is a fallback', async () => {
		const original = entryExample()
		const fallback = {
			...original,
			locale: 'en',
			fallback: true,
			slug: 'hello-world',
			collection: { ...original.collection, slug: 'artigos' }
		}
		const html = await renderComponent(Seo, {
			props: { entry: fallback },
			locals: localesFor(),
			url: 'https://site.example/pt/artigos/hello-world'
		})
		expect(linkHrefs(html, 'canonical')).toEqual(['https://site.example/en/blog/hello-world'])
		expect(metaContent(html, 'property', 'og:url')).toEqual([
			'https://site.example/en/blog/hello-world'
		])
	})

	it('fails clearly without the site option', async () => {
		await expect(
			renderComponent(Seo, {
				props: { entry: entryExample() },
				locals: localesFor(),
				site: undefined
			})
		).rejects.toThrow('needs "site" set in astro.config')
	})
})

describe('Seo for the homepage', () => {
	it('reads meta title, description and og image', async () => {
		const homepage = homepageExample()
		const html = await renderComponent(Seo, {
			props: { homepage },
			locals: localesFor(),
			url: 'https://site.example/pt'
		})
		expect(html).toContain(`<title>${homepage.meta?.title}</title>`)
		expect(metaContent(html, 'name', 'description')).toEqual([homepage.meta?.description])
		expect(metaContent(html, 'property', 'og:image')).toEqual([homepage.meta?.og_image])
		expect(metaContent(html, 'property', 'og:type')).toEqual(['website'])
		expect(metaContent(html, 'property', 'og:locale')).toEqual(['pt-BR'])
		expect(linkHrefs(html, 'canonical')).toEqual(['https://site.example/pt'])
	})

	it('renders only canonical and locale when meta was never set', async () => {
		const homepage = { ...homepageExample(), meta: null }
		const html = await renderComponent(Seo, { props: { homepage }, locals: localesFor() })
		expect(html).not.toContain('<title>')
		expect(metaContent(html, 'name', 'description')).toEqual([])
		expect(linkHrefs(html, 'canonical')).toEqual(['https://site.example/pt'])
	})

	it('points canonical at the original homepage when served as a fallback', async () => {
		const homepage = { ...homepageExample(), locale: 'en', fallback: true }
		const html = await renderComponent(Seo, { props: { homepage }, locals: localesFor() })
		expect(linkHrefs(html, 'canonical')).toEqual(['https://site.example/en'])
	})
})
