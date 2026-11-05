import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { describe, expect, it } from 'vitest'
import RushImage from '../src/components/rush-image.astro'

async function render(props: Record<string, unknown>) {
	const container = await AstroContainer.create()
	return container.renderToString(RushImage, { props })
}

describe('RushImage', () => {
	const media = { url: 'https://cdn.example.com/s/m/master', width: 640, height: 480, alt: 'Alt' }

	it('passes width, height, alt and remaining props to the image', async () => {
		const html = await render({ media, loading: 'eager', class: 'hero' })
		expect(html).toContain('src="https://cdn.example.com/s/m/master"')
		expect(html).toContain('width="640"')
		expect(html).toContain('height="480"')
		expect(html).toContain('alt="Alt"')
		expect(html).toContain('loading="eager"')
		expect(html).toContain('class="hero"')
	})

	it('lets the alt prop win over the media alt', async () => {
		expect(await render({ media, alt: 'Override' })).toContain('alt="Override"')
	})

	it('renders nothing without a usable media entry', async () => {
		expect(await render({ media: undefined })).toBe('')
		expect(await render({ media: { width: 1, height: 1 } })).toBe('')
		expect(await render({ media: { url: 'https://x.test/a' } })).toBe('')
	})
})
