import { describe, expect, it } from 'vitest'
import Callout from './fixtures/components/callout.astro'
import ShoutHeading from './fixtures/components/shout-heading.astro'
import { doc, paragraph, render, text } from './fixtures/rich-text'
import type { RichTextContent } from '../src/components/rich-text-model'

const MEDIA_ID = '01JABCDEFGHJKMNPQRSTVWXYZ0'
const MEDIA = {
	[MEDIA_ID]: {
		url: 'https://cdn.example.com/site/media/master',
		width: 800,
		height: 600,
		alt: 'Media alt'
	}
}

function nodeOf(type: string, children: RichTextContent[], attrs?: Record<string, unknown>) {
	return attrs ? { type, attrs, content: children } : { type, content: children }
}

describe('rich text structure', () => {
	it('renders the StarterKit nodes', async () => {
		const html = await render(
			doc(
				nodeOf('heading', [text('Title')], { level: 3 }),
				paragraph(text('one'), { type: 'hardBreak' }, text('two')),
				nodeOf('bulletList', [nodeOf('listItem', [paragraph(text('a'))])]),
				nodeOf('orderedList', [nodeOf('listItem', [paragraph(text('b'))])], { start: 3 }),
				nodeOf('blockquote', [paragraph(text('quoted'))]),
				{ type: 'horizontalRule' }
			)
		)
		expect(html).toContain('<h3>Title</h3>')
		expect(html).toContain('<p>one<br>two</p>')
		expect(html).toContain('<ul><li><p>a</p></li></ul>')
		expect(html).toContain('<ol start="3"><li><p>b</p></li></ol>')
		expect(html).toContain('<blockquote><p>quoted</p></blockquote>')
		expect(html).toContain('<hr>')
	})

	it('omits start for lists starting at one and clamps unknown heading levels', async () => {
		const html = await render(
			doc(
				nodeOf('orderedList', [nodeOf('listItem', [paragraph(text('b'))])], { start: 1 }),
				nodeOf('heading', [text('X')], { level: 9 })
			)
		)
		expect(html).toContain('<ol><li>')
		expect(html).toContain('<h2>X</h2>')
	})

	it('renders a code block with its language', async () => {
		const html = await render(
			doc(
				nodeOf('codeBlock', [text('const a = 1')], { language: 'ts' }),
				nodeOf('codeBlock', [text('plain')], { language: 'a" onclick="x' }),
				nodeOf('codeBlock', [text('none')])
			)
		)
		expect(html).toContain('<pre><code class="language-ts">const a = 1</code></pre>')
		expect(html).toContain('<pre><code>plain</code></pre>')
		expect(html).toContain('<pre><code>none</code></pre>')
	})

	it('renders unknown node types as their children only', async () => {
		const html = await render(doc(nodeOf('mystery', [paragraph(text('inside'))])))
		expect(html).toContain('<p>inside</p>')
		expect(html).not.toContain('mystery')
	})

	it('renders nesting up to 32 levels and drops deeper nodes', async () => {
		const nest = (levels: number): RichTextContent => {
			let node: RichTextContent = { type: 'horizontalRule' }
			for (let level = 0; level < levels; level++) {
				node = nodeOf('blockquote', [node])
			}
			return node
		}
		const within = await render(doc(nest(31)))
		expect(within).toContain('<hr>')
		const beyond = await render(doc(nest(32)))
		expect(beyond).not.toContain('<hr>')
		expect(beyond.match(/<blockquote>/g)).toHaveLength(32)
	})

	it('renders nothing for a missing document', async () => {
		const container = await import('./fixtures/rich-text')
		expect(await container.render({ type: 'doc' })).toBe('')
	})
})

describe('rich text marks', () => {
	it('renders every mark and nests them in order', async () => {
		const marks = [
			'bold',
			'italic',
			'strike',
			'underline',
			'code',
			'subscript',
			'superscript',
			'highlight'
		]
		const html = await render(doc(paragraph(...marks.map((type) => text(type, [{ type }])))))
		expect(html).toContain('<strong>bold</strong>')
		expect(html).toContain('<em>italic</em>')
		expect(html).toContain('<s>strike</s>')
		expect(html).toContain('<u>underline</u>')
		expect(html).toContain('<code>code</code>')
		expect(html).toContain('<sub>subscript</sub>')
		expect(html).toContain('<sup>superscript</sup>')
		expect(html).toContain('<mark>highlight</mark>')
		const nested = await render(
			doc(paragraph(text('x', [{ type: 'bold' }, { type: 'italic' }])))
		)
		expect(nested).toContain('<strong><em>x</em></strong>')
	})

	it('renders links with target and rel only from the mark', async () => {
		const html = await render(
			doc(
				paragraph(
					text('plain', [{ type: 'link', attrs: { href: '/a' } }]),
					text('blank', [
						{
							type: 'link',
							attrs: { href: 'https://x.test', target: '_blank', rel: 'evil' }
						}
					]),
					text('rel', [{ type: 'link', attrs: { href: '/b', rel: 'nofollow' } }])
				)
			)
		)
		expect(html).toContain('<a href="/a">plain</a>')
		expect(html).toContain(
			'<a href="https://x.test" target="_blank" rel="noopener noreferrer">blank</a>'
		)
		expect(html).toContain('<a href="/b">rel</a>')
		expect(html).not.toContain('evil')
		expect(html).not.toContain('nofollow')
	})

	it('renders a link with an empty href as plain text, keeping other marks', async () => {
		const html = await render(
			doc(
				paragraph(
					text('unsafe', [{ type: 'link', attrs: { href: '' } }, { type: 'bold' }]),
					text('none', [{ type: 'link' }])
				)
			)
		)
		expect(html).toContain('<strong>unsafe</strong>')
		expect(html).toContain('none')
		expect(html).not.toContain('<a')
	})

	it.each([
		'javascript:alert(1)',
		' JaVaScRiPt:alert(1)',
		'java\tscript:alert(1)',
		'java\nscript:alert(1)',
		'data:text/html,<b>x</b>',
		'vbscript:x',
		'foo:bar'
	])('renders an unsafe href %j as plain text', async (href) => {
		const html = await render(
			doc(paragraph(text('t', [{ type: 'link', attrs: { href } }, { type: 'bold' }])))
		)
		expect(html).toContain('<strong>t</strong>')
		expect(html).not.toContain('<a')
	})

	it.each([
		'http://x.test/a',
		'HTTPS://x.test',
		'mailto:a@x.test',
		'tel:+5511',
		'/path',
		'#top',
		'?q=1',
		'page.html',
		'a/b:c',
		'//cdn.x.test/a'
	])('keeps a safe href %j', async (href) => {
		const html = await render(doc(paragraph(text('t', [{ type: 'link', attrs: { href } }]))))
		expect(html).toContain('<a href=')
	})

	it('ignores unknown marks', async () => {
		const html = await render(doc(paragraph(text('x', [{ type: 'weird' }]))))
		expect(html).toContain('<p>x</p>')
	})
})

describe('rich text escaping', () => {
	it('escapes text, link attributes and block values', async () => {
		const payload = '<script>alert(1)</script>'
		const html = await render(
			doc(
				paragraph(
					text(payload),
					text('l', [{ type: 'link', attrs: { href: '/a"><script>' } }])
				),
				{ type: 'customBlock', attrs: { block: 'callout', values: { title: payload } } }
			),
			{ blocks: { callout: Callout } }
		)
		expect(html).not.toContain('<script>alert')
		expect(html.match(/&lt;script&gt;alert\(1\)&lt;\/script&gt;/g)).toHaveLength(2)
		expect(html).toContain('<a href="/a&quot;><script>">l</a>')
	})
})

describe('rich text images', () => {
	it('joins an image with media by mediaId, alt from the node first', async () => {
		const withAlt = await render(
			doc({
				type: 'image',
				attrs: { src: '/stale.png', alt: 'Node alt', align: 'left', mediaId: MEDIA_ID }
			}),
			{ media: MEDIA }
		)
		expect(withAlt).toContain('<figure data-align="left">')
		expect(withAlt).toContain('src="https://cdn.example.com/site/media/master"')
		expect(withAlt).toContain('width="800"')
		expect(withAlt).toContain('height="600"')
		expect(withAlt).toContain('alt="Node alt"')
		const mediaAlt = await render(
			doc({ type: 'image', attrs: { src: '', alt: '', mediaId: MEDIA_ID } }),
			{
				media: MEDIA
			}
		)
		expect(mediaAlt).toContain('alt="Media alt"')
	})

	it('falls back to attrs.src when the media entry is missing', async () => {
		const html = await render(
			doc({ type: 'image', attrs: { src: '/local.png', alt: 'Local', mediaId: MEDIA_ID } })
		)
		expect(html).toContain('<img src="/local.png" alt="Local" loading="lazy">')
		expect(html).not.toContain('width=')
	})

	it('renders nothing for an image without a source', async () => {
		const html = await render(doc({ type: 'image', attrs: { src: '', alt: '' } }))
		expect(html).not.toContain('<img')
	})

	it('renders a gallery with captions, layout and lightbox', async () => {
		const html = await render(
			doc({
				type: 'gallery',
				attrs: {
					layout: 'grid',
					lightbox: true,
					images: [
						{ src: '/stale.png', alt: '', caption: 'First', mediaId: MEDIA_ID },
						{ src: '/b.png', alt: 'B', caption: '', mediaId: null }
					]
				}
			}),
			{ media: MEDIA }
		)
		expect(html).toContain('data-type="gallery"')
		expect(html).toContain('data-layout="grid"')
		expect(html).toContain('data-lightbox="true"')
		expect(html).toContain('src="https://cdn.example.com/site/media/master"')
		expect(html).toContain('<figcaption>First</figcaption>')
		expect(html).toContain('<img src="/b.png" alt="B" loading="lazy">')
		expect(html.match(/<figcaption>/g)).toHaveLength(1)
	})
})

describe('rich text custom blocks and overrides', () => {
	const block = (name: string): RichTextContent => ({
		type: 'customBlock',
		attrs: { block: name, values: { title: 'Hello' } }
	})

	it('renders a mapped block with its values', async () => {
		const html = await render(doc(block('callout')), { blocks: { callout: Callout } })
		expect(html).toContain('<aside class="callout">Hello</aside>')
	})

	it('renders nothing for an unmapped block', async () => {
		const html = await render(doc(paragraph(text('kept')), block('unknown')), {
			blocks: { callout: Callout }
		})
		expect(html.trim()).toBe('<p>kept</p>')
		const inherited = await render(doc(block('constructor')))
		expect(inherited).toBe('')
	})

	it('lets a site override a node type and render children through the slot', async () => {
		const html = await render(doc(nodeOf('heading', [text('Big')], { level: 1 })), {
			nodes: { heading: ShoutHeading }
		})
		expect(html).toContain('<h2 class="shout">Big</h2>')
		expect(html).not.toContain('<h1>')
	})
})
