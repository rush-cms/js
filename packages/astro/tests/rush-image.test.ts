import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import RushImage from '../src/components/rush-image.astro'
import {
	WIDTH_LADDER,
	boxStyle,
	imageFrame,
	isOptimizable,
	probeOnce,
	responsiveProps,
	responsiveWidths
} from '../src/components/rush-image-model'
import type {
	ImageFrame,
	ImageLayout,
	ImageSize,
	ResponsiveRequest
} from '../src/components/rush-image-model'
import { startImageServer } from './fixtures/images'
import type { ImageServer } from './fixtures/images'

type ImageAttributes = Record<string, string>

const SERVED: ImageSize = { width: 1200, height: 800 }
const DIMENSIONS: readonly unknown[] = [undefined, 0, -5, Number.NaN, Infinity, '640', 640]
const RATIOS: readonly unknown[] = [undefined, 0, -1, Number.NaN, 1.5]
const LAYOUTS: readonly (ImageLayout | undefined)[] = [
	undefined,
	'constrained',
	'fixed',
	'full-width',
	'none'
]

let server: ImageServer

beforeAll(async () => {
	server = await startImageServer({ '/served': SERVED, '/cached': SERVED, '/inferred': SERVED })
})

afterAll(async () => {
	await server.close()
})

async function render(props: Record<string, unknown>) {
	const container = await AstroContainer.create()
	return container.renderToString(RushImage, { props })
}

function attributesOf(html: string): ImageAttributes {
	const tag = /^<img ([^>]*)>$/.exec(html)?.[1] ?? ''
	return Object.fromEntries(
		[...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map((match) => [
			match[1] ?? '',
			match[2] ?? ''
		])
	)
}

function srcsetWidths(attributes: ImageAttributes): number[] {
	return (attributes.srcset ?? '')
		.split(', ')
		.filter((candidate) => candidate !== '')
		.map((candidate) => Number(/ (\d+)w$/.exec(candidate)?.[1]))
}

function isDimension(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
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

	it('renders nothing without a media url', async () => {
		expect(await render({ media: undefined })).toBe('')
		expect(await render({ media: { width: 1, height: 1 } })).toBe('')
	})

	it('keeps an image outside the allowed domains unoptimized and without srcset', async () => {
		const attributes = attributesOf(await render({ media, widths: [320] }))
		expect(attributes.src).toBe(media.url)
		expect(attributes.srcset).toBeUndefined()
		expect(attributes.sizes).toBeUndefined()
	})

	it('falls back to a plain img when the size cannot be resolved and no aspect ratio is set', async () => {
		const pending = { url: 'https://x.test/a', alt: 'Pending' }
		expect(await render({ media: pending })).toBe(
			'<img loading="lazy" decoding="async" src="https://x.test/a" alt="Pending">'
		)
		expect(
			await render({ media: { ...pending, width: 640 }, loading: 'eager', class: 'hero' })
		).toBe(
			'<img loading="eager" decoding="async" class="hero" src="https://x.test/a" alt="Pending">'
		)
		expect(await render({ media: pending, priority: true })).toContain('loading="eager"')
	})

	it('emits srcset and sizes for an allowed media, capped at its own width', async () => {
		const sized = { url: server.url('/served'), ...SERVED }
		const attributes = attributesOf(await render({ media: sized }))
		expect(srcsetWidths(attributes)).toEqual(responsiveWidths(SERVED.width))
		expect(attributes.sizes).toBe('(min-width: 1200px) 1200px, 100vw')
		expect(attributes.src).toContain('/_image?href=')
		expect([attributes.width, attributes.height]).toEqual(['1200', '800'])
	})

	it('lets sizes, widths and layout props shape the srcset', async () => {
		const sized = { url: server.url('/served'), ...SERVED }
		const custom = attributesOf(
			await render({
				media: sized,
				sizes: '(min-width: 1024px) 400px, 100vw',
				widths: [400, 800]
			})
		)
		expect(srcsetWidths(custom)).toEqual([400, 800])
		expect(custom.sizes).toBe('(min-width: 1024px) 400px, 100vw')
		const full = attributesOf(await render({ media: sized, layout: 'full-width' }))
		expect(full.sizes).toBe('100vw')
		const none = attributesOf(await render({ media: sized, layout: 'none' }))
		expect(none.srcset).toBeUndefined()
		expect(none.sizes).toBeUndefined()
	})

	it('resolves the dimensions of an allowed media that has none, once per url', async () => {
		const inferred = { url: server.url('/inferred'), alt: 'Inferred' }
		const first = attributesOf(await render({ media: inferred }))
		const second = attributesOf(await render({ media: inferred }))
		for (const attributes of [first, second]) {
			expect([attributes.width, attributes.height]).toEqual(['1200', '800'])
			expect(srcsetWidths(attributes)).toEqual(responsiveWidths(SERVED.width))
		}
		expect(server.hits('/inferred')).toBe(1)
	})

	it('reserves an aspect box when the size cannot be resolved', async () => {
		const missing = { url: server.url('/missing'), alt: 'Missing' }
		expect(attributesOf(await render({ media: missing, aspectRatio: 1.5 })).style).toBe(
			'aspect-ratio: 1.5'
		)
		expect(
			attributesOf(await render({ media: missing, aspectRatio: 2, style: 'color: red' }))
				.style
		).toBe('aspect-ratio: 2; color: red')
		expect(
			attributesOf(await render({ media: missing, aspectRatio: 2, style: { color: 'red' } }))
				.style
		).toBe('aspect-ratio:2;color:red')
	})

	it('never renders an image without a reserved box for an allowed media, in every combination', async () => {
		const paths = ['/served', '/missing']
		for (const path of paths) {
			for (const width of [undefined, 0, SERVED.width]) {
				for (const height of [undefined, 0, SERVED.height]) {
					for (const aspectRatio of [undefined, 1.5]) {
						const known =
							width !== undefined && width > 0 && height !== undefined && height > 0
						const resolvable = known || path === '/served'
						const attributes = attributesOf(
							await render({
								media: { url: server.url(path), width, height },
								aspectRatio
							})
						)
						expect(
							attributes.width !== undefined && attributes.height !== undefined
						).toBe(resolvable)
						expect(srcsetWidths(attributes).length > 0).toBe(resolvable)
						expect(attributes.style === 'aspect-ratio: 1.5').toBe(
							!resolvable && aspectRatio !== undefined
						)
					}
				}
			}
		}
	})
})

describe('imageFrame', () => {
	it('sizes from the media, then the lookup, then boxes by aspect ratio, for every combination', async () => {
		let checked = 0
		for (const width of DIMENSIONS) {
			for (const height of DIMENSIONS) {
				for (const found of [SERVED, undefined]) {
					for (const aspectRatio of RATIOS) {
						const media = { url: 'https://cdn.example.com/m', width, height }
						const frame = await imageFrame(
							media as Parameters<typeof imageFrame>[0],
							aspectRatio,
							() => Promise.resolve(found)
						)
						const expected: ImageFrame =
							isDimension(width) && isDimension(height)
								? { kind: 'sized', url: media.url, size: { width, height } }
								: found !== undefined
									? { kind: 'sized', url: media.url, size: found }
									: isDimension(aspectRatio)
										? { kind: 'boxed', url: media.url, aspectRatio }
										: { kind: 'plain', url: media.url }
						expect(frame).toEqual(expected)
						checked += 1
					}
				}
			}
		}
		expect(checked).toBe(DIMENSIONS.length ** 2 * 2 * RATIOS.length)
	})

	it('is undefined without a url and never looks one up', async () => {
		for (const media of [undefined, {}, { url: '' }, { url: '', width: 1, height: 1 }]) {
			expect(await imageFrame(media, 1, () => Promise.reject(new Error('looked up')))).toBe(
				undefined
			)
		}
	})
})

describe('probeOnce', () => {
	it('probes a url once, retries after a failure and drops sizes that are not positive', async () => {
		const calls: string[] = []
		const sizes: (ImageSize | Error)[] = [
			new Error('offline'),
			{ width: 0, height: 10 },
			{ width: 30, height: 20 }
		]
		const probe = (url: string) => {
			calls.push(url)
			const next = sizes.shift() ?? new Error('exhausted')
			return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
		}
		const url = server.url('/probe-once')
		expect(await probeOnce(url, probe)).toBeUndefined()
		expect(await probeOnce(url, probe)).toBeUndefined()
		expect(await probeOnce(url, probe)).toEqual({ width: 30, height: 20 })
		expect(await probeOnce(url, probe)).toEqual({ width: 30, height: 20 })
		expect(calls).toEqual([url, url, url])
	})

	it('treats a probe that throws synchronously as a failure', async () => {
		const probe = () => {
			throw new Error('sync')
		}
		expect(await probeOnce(server.url('/probe-sync'), probe)).toBeUndefined()
	})
})

describe('responsiveWidths', () => {
	it('is the ascending ladder below the width plus the width itself, for every width', () => {
		for (let width = 1; width <= 2600; width += 1) {
			const widths = responsiveWidths(width)
			expect(widths).toEqual([...WIDTH_LADDER.filter((step) => step < width), width])
			expect(widths.at(-1)).toBe(width)
			expect(
				widths.every((step, index) => index === 0 || step > (widths[index - 1] ?? 0))
			).toBe(true)
		}
	})

	it('uses the configured breakpoints when given', () => {
		expect(responsiveWidths(900, [1000, 300, 600])).toEqual([300, 600, 900])
		expect(responsiveWidths(600, [600, 300])).toEqual([300, 600])
	})
})

describe('responsiveProps', () => {
	it('picks layout and widths for every combination of request', () => {
		const size: ImageSize = { width: 900, height: 600 }
		for (const optimizable of [true, false]) {
			for (const layout of LAYOUTS) {
				for (const configLayout of LAYOUTS) {
					for (const widths of [undefined, [100, 200]]) {
						for (const breakpoints of [undefined, [300, 600, 3000]]) {
							const request: ResponsiveRequest = {
								optimizable,
								layout,
								configLayout,
								widths,
								breakpoints
							}
							const resolved = layout ?? configLayout ?? 'constrained'
							const props = responsiveProps(size, request)
							if (!optimizable) {
								expect(props).toEqual({ layout: 'none' })
							} else if (widths !== undefined) {
								expect(props).toEqual({ layout: resolved, widths })
							} else if (resolved === 'none') {
								expect(props).toEqual({ layout: 'none' })
							} else {
								expect(props).toEqual({
									layout: resolved,
									widths: responsiveWidths(size.width, breakpoints)
								})
							}
						}
					}
				}
			}
		}
	})
})

describe('isOptimizable', () => {
	it('matches the configured domains and patterns, ignoring pattern keys left undefined', () => {
		const config = {
			domains: ['cdn.example.com'],
			remotePatterns: [
				{
					protocol: 'http',
					hostname: 'media.example.com',
					port: undefined,
					pathname: undefined
				}
			]
		}
		expect(isOptimizable('https://cdn.example.com/a', config)).toBe(true)
		expect(isOptimizable('http://media.example.com:8080/a', config)).toBe(true)
		expect(isOptimizable('https://media.example.com/a', config)).toBe(false)
		expect(isOptimizable('https://other.example.com/a', config)).toBe(false)
		expect(isOptimizable('/relative', config)).toBe(false)
		expect(isOptimizable('https://cdn.example.com/a', {})).toBe(false)
	})
})

describe('boxStyle', () => {
	it('puts the aspect ratio before any style of the caller', () => {
		expect(boxStyle(1.5, undefined)).toBe('aspect-ratio: 1.5')
		expect(boxStyle(1.5, null)).toBe('aspect-ratio: 1.5')
		expect(boxStyle(1.5, '  ')).toBe('aspect-ratio: 1.5')
		expect(boxStyle(1.5, 'color: red')).toBe('aspect-ratio: 1.5; color: red')
		expect(boxStyle(1.5, { color: 'red' })).toEqual({ 'aspect-ratio': '1.5', color: 'red' })
	})
})
