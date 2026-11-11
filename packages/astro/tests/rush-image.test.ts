import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import RushImage from '../src/components/rush-image.astro'
import {
	boxStyle,
	cappedWidths,
	imageFrame,
	isOptimizable,
	loadingHints,
	probeDeadline,
	probeOnce,
	responsiveProps,
	responsiveWidths
} from '../src/components/rush-image-model'
import type {
	ImageFrame,
	ImageLayout,
	ImageSize,
	ProbeDeadline,
	ResponsiveProps,
	ResponsiveRequest
} from '../src/components/rush-image-model'
import { probeRemoteSize } from '../src/components/remote-size'
import type { RemoteFetch } from '../src/components/remote-size'
import { pngHeader, startImageServer } from './fixtures/images'
import type { ImageServer } from './fixtures/images'

type ImageAttributes = Record<string, string>

type Candidate = {
	value: unknown
	valid: boolean
}

type ControlledDeadline = ProbeDeadline & {
	expire(): void
	cancelled(): number
}

type StreamedImage = {
	fetcher: RemoteFetch
	requested(): string[]
	bytesRead(): number
	cancelled(): number
}

type RecordedFetch = {
	fetcher: RemoteFetch
	signals(): (AbortSignal | null | undefined)[]
}

type ResponsiveCase = {
	request: ResponsiveRequest
	expected: ResponsiveProps
}

const SERVED: ImageSize = { width: 1200, height: 800 }
const SMALL: ImageSize = { width: 300, height: 200 }
const SERVED_WIDTHS = [320, 480, 640, 800, 1024, 1200]
const LADDER = [320, 480, 640, 800, 1024, 1280, 1600, 1920]
const DIMENSIONS: readonly Candidate[] = [
	{ value: undefined, valid: false },
	{ value: 0, valid: false },
	{ value: -5, valid: false },
	{ value: Number.NaN, valid: false },
	{ value: Infinity, valid: false },
	{ value: '640', valid: false },
	{ value: 640, valid: true }
]
const RATIOS: readonly Candidate[] = [
	{ value: undefined, valid: false },
	{ value: 0, valid: false },
	{ value: -1, valid: false },
	{ value: Number.NaN, valid: false },
	{ value: 1.5, valid: true }
]
const LAYOUTS: readonly (ImageLayout | undefined)[] = [
	undefined,
	'constrained',
	'fixed',
	'full-width',
	'none'
]

let server: ImageServer

beforeAll(async () => {
	server = await startImageServer({ '/served': SERVED, '/small': SMALL, '/inferred': SERVED })
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

function controlledDeadline(): ControlledDeadline {
	let expire: () => void = () => undefined
	let cancels = 0
	const expired = new Promise<void>((resolve) => {
		expire = resolve
	})
	return {
		expired,
		cancel: () => {
			cancels += 1
		},
		expire: () => expire(),
		cancelled: () => cancels
	}
}

const REMOTE_CONFIG = { remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }] }
const CHUNK_BYTES = 8
const TRAILING_CHUNKS = 6

function chunked(bytes: Uint8Array): Uint8Array[] {
	const chunks: Uint8Array[] = []
	for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
		chunks.push(bytes.slice(start, start + CHUNK_BYTES))
	}
	return chunks
}

function streamedImage(size: ImageSize): StreamedImage {
	const requested: string[] = []
	const chunks = [
		...chunked(pngHeader(size)),
		...Array.from({ length: TRAILING_CHUNKS }, () => new Uint8Array(CHUNK_BYTES))
	]
	let read = 0
	let cancels = 0
	let next = 0
	return {
		fetcher: (input) => {
			requested.push(input instanceof Request ? input.url : String(input))
			const body = new ReadableStream<Uint8Array>(
				{
					pull(controller) {
						const chunk = chunks[next]
						next += 1
						if (chunk === undefined) {
							controller.close()
							return
						}
						read += chunk.length
						controller.enqueue(chunk)
					},
					cancel() {
						cancels += 1
					}
				},
				{ highWaterMark: 0 }
			)
			return Promise.resolve(new Response(body, { status: 200 }))
		},
		requested: () => requested,
		bytesRead: () => read,
		cancelled: () => cancels
	}
}

function recordedFetch(
	respond: (signal: AbortSignal | null | undefined) => Promise<Response>
): RecordedFetch {
	const signals: (AbortSignal | null | undefined)[] = []
	return {
		fetcher: (_input, init) => {
			signals.push(init?.signal)
			return respond(init?.signal)
		},
		signals: () => signals
	}
}

function abortable(signal: AbortSignal | null | undefined): Promise<Response> {
	return new Promise<Response>((_resolve, reject) => {
		signal?.addEventListener('abort', () => reject(new Error('aborted')))
	})
}

function isAscending(widths: number[]): boolean {
	return widths.every((step, index) => index === 0 || step > (widths[index - 1] ?? 0))
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
	})

	it('loads a prioritized image eagerly with a high fetch priority on every path', async () => {
		const plain = attributesOf(
			await render({ media: { url: 'https://x.test/a' }, priority: true })
		)
		const boxed = attributesOf(
			await render({ media: { url: 'https://x.test/a' }, priority: true, aspectRatio: 2 })
		)
		const sized = attributesOf(
			await render({ media: { url: server.url('/served'), ...SERVED }, priority: true })
		)
		for (const attributes of [plain, boxed, sized]) {
			expect([attributes.loading, attributes.decoding, attributes.fetchpriority]).toEqual([
				'eager',
				'sync',
				'high'
			])
		}
		expect(boxed.style).toBe('aspect-ratio: 2')
		expect(sized.srcset).toBeDefined()
		const overridden = attributesOf(
			await render({ media: { url: 'https://x.test/a' }, priority: true, decoding: 'async' })
		)
		expect(overridden.decoding).toBe('async')
	})

	it('emits srcset and sizes for an allowed media, capped at its own width', async () => {
		const sized = { url: server.url('/served'), ...SERVED }
		const attributes = attributesOf(await render({ media: sized }))
		expect(srcsetWidths(attributes)).toEqual(SERVED_WIDTHS)
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

	it('never asks for widths above the intrinsic width, explicit ones included', async () => {
		const small = { url: server.url('/small'), ...SMALL }
		const capped = attributesOf(await render({ media: small, widths: [300, 600, 1200] }))
		expect(srcsetWidths(capped)).toEqual([300])
		const topped = attributesOf(await render({ media: small, widths: [100, 600] }))
		expect(srcsetWidths(topped)).toEqual([100, 300])
		expect(srcsetWidths(attributesOf(await render({ media: small })))).toEqual([300])
	})

	it('resolves the dimensions of an allowed media that has none, once per url', async () => {
		const inferred = { url: server.url('/inferred'), alt: 'Inferred' }
		const first = attributesOf(await render({ media: inferred }))
		const second = attributesOf(await render({ media: inferred }))
		for (const attributes of [first, second]) {
			expect([attributes.width, attributes.height]).toEqual(['1200', '800'])
			expect(srcsetWidths(attributes)).toEqual(SERVED_WIDTHS)
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
						const url = 'https://cdn.example.com/m'
						const media = { url, width: width.value, height: height.value }
						const frame = await imageFrame(
							media as Parameters<typeof imageFrame>[0],
							aspectRatio.value,
							() => Promise.resolve(found)
						)
						const expected: ImageFrame =
							width.valid && height.valid
								? { kind: 'sized', url, size: { width: 640, height: 640 } }
								: found !== undefined
									? { kind: 'sized', url, size: found }
									: aspectRatio.valid
										? { kind: 'boxed', url, aspectRatio: 1.5 }
										: { kind: 'plain', url }
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
	it('probes a url once and remembers a failure for the rest of the process', async () => {
		const calls: string[] = []
		const probe = (url: string) => {
			calls.push(url)
			return Promise.reject(new Error('offline'))
		}
		const url = 'https://cdn.example.com/probe-failure'
		expect(await probeOnce(url, probe)).toBeUndefined()
		expect(await probeOnce(url, probe)).toBeUndefined()
		expect(calls).toEqual([url])
	})

	it('remembers a size and drops one that is not positive', async () => {
		const calls: string[] = []
		const sized = (url: string) => {
			calls.push(url)
			return Promise.resolve({ width: 30, height: 20 })
		}
		const flat = () => Promise.resolve({ width: 0, height: 10 })
		const url = 'https://cdn.example.com/probe-size'
		expect(await probeOnce(url, sized)).toEqual({ width: 30, height: 20 })
		expect(await probeOnce(url, sized)).toEqual({ width: 30, height: 20 })
		expect(calls).toEqual([url])
		expect(await probeOnce('https://cdn.example.com/probe-flat', flat)).toBeUndefined()
	})

	it('treats a probe that throws synchronously as a failure', async () => {
		const probe = () => {
			throw new Error('sync')
		}
		expect(await probeOnce('https://cdn.example.com/probe-sync', probe)).toBeUndefined()
	})

	it('gives up on a probe that never settles once its deadline expires, and remembers it', async () => {
		const deadline = controlledDeadline()
		const calls: string[] = []
		const signals: AbortSignal[] = []
		const hang = (url: string, signal: AbortSignal) => {
			calls.push(url)
			signals.push(signal)
			return new Promise<ImageSize>(() => undefined)
		}
		const url = 'https://cdn.example.com/probe-hang'
		const pending = probeOnce(url, hang, () => deadline)
		deadline.expire()
		expect(await pending).toBeUndefined()
		expect(await probeOnce(url, hang, () => deadline)).toBeUndefined()
		expect(calls).toEqual([url])
		expect(signals).toHaveLength(1)
		expect(signals[0]?.aborted).toBe(true)
		expect(deadline.cancelled()).toBe(1)
	})

	it('leaves the signal alone when the probe answers first', async () => {
		const signals: AbortSignal[] = []
		await probeOnce(
			'https://cdn.example.com/probe-quiet',
			(_url, signal) => {
				signals.push(signal)
				return Promise.resolve({ width: 4, height: 3 })
			},
			() => controlledDeadline()
		)
		expect(signals[0]?.aborted).toBe(false)
	})

	it('cancels the deadline when the probe answers first', async () => {
		const deadline = controlledDeadline()
		const size = await probeOnce(
			'https://cdn.example.com/probe-fast',
			() => Promise.resolve({ width: 4, height: 3 }),
			() => deadline
		)
		expect(size).toEqual({ width: 4, height: 3 })
		expect(deadline.cancelled()).toBe(1)
	})
})

describe('probeRemoteSize', () => {
	const url = 'https://cdn.example.com/photo.png'
	const live = new AbortController().signal

	it('reads the size, stops reading once it is known and cancels the body', async () => {
		const image = streamedImage({ width: 640, height: 480 })
		const size = await probeRemoteSize(url, REMOTE_CONFIG, live, image.fetcher)
		expect(size).toEqual({ width: 640, height: 480 })
		expect(image.requested()).toEqual([url])
		expect(image.bytesRead()).toBeLessThanOrEqual(
			pngHeader({ width: 1, height: 1 }).length + CHUNK_BYTES
		)
		expect(image.bytesRead()).toBeLessThan((TRAILING_CHUNKS + 1) * CHUNK_BYTES)
		expect(image.cancelled()).toBe(1)
	})

	it('cancels the body and fails when no dimensions can be found', async () => {
		const garbage: RemoteFetch = () =>
			Promise.resolve(
				new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(new Uint8Array(CHUNK_BYTES))
							controller.close()
						}
					})
				)
			)
		await expect(probeRemoteSize(url, REMOTE_CONFIG, live, garbage)).rejects.toThrow(
			'no image dimensions'
		)
	})

	it('never fetches a host outside the allowlist', async () => {
		const image = streamedImage({ width: 1, height: 1 })
		await expect(
			probeRemoteSize('https://other.example.net/x.png', REMOTE_CONFIG, live, image.fetcher)
		).rejects.toThrow('not an allowed remote image')
		expect(image.requested()).toEqual([])
	})

	it('rejects a redirect to a host outside the allowlist', async () => {
		const redirecting: RemoteFetch = () =>
			Promise.resolve(
				new Response(null, {
					status: 302,
					headers: { Location: 'https://other.example.net/x.png' }
				})
			)
		await expect(probeRemoteSize(url, REMOTE_CONFIG, live, redirecting)).rejects.toThrow(
			'not an allowed remote location'
		)
	})

	it('fails on a response without a usable body', async () => {
		const missing: RemoteFetch = () => Promise.resolve(new Response(null, { status: 404 }))
		await expect(probeRemoteSize(url, REMOTE_CONFIG, live, missing)).rejects.toThrow('404')
	})

	it('aborts the request when the probe deadline expires, and remembers the failure', async () => {
		const deadline = controlledDeadline()
		const recorded = recordedFetch(abortable)
		const probe = (target: string, signal: AbortSignal) =>
			probeRemoteSize(target, REMOTE_CONFIG, signal, recorded.fetcher)
		const target = 'https://cdn.example.com/stalled.png'
		const pending = probeOnce(target, probe, () => deadline)
		await vi.waitFor(() => expect(recorded.signals()).toHaveLength(1))
		expect(recorded.signals()[0]?.aborted).toBe(false)
		deadline.expire()
		expect(await pending).toBeUndefined()
		expect(recorded.signals()[0]?.aborted).toBe(true)
		expect(await probeOnce(target, probe, () => deadline)).toBeUndefined()
		expect(recorded.signals()).toHaveLength(1)
	})
})

describe('probeDeadline', () => {
	it('expires at its timeout, 8 s by default, and never once cancelled', async () => {
		vi.useFakeTimers()
		try {
			let expired = false
			void probeDeadline().expired.then(() => {
				expired = true
			})
			await vi.advanceTimersByTimeAsync(7999)
			expect(expired).toBe(false)
			await vi.advanceTimersByTimeAsync(1)
			expect(expired).toBe(true)
			let fired = false
			const cancelled = probeDeadline(100)
			void cancelled.expired.then(() => {
				fired = true
			})
			cancelled.cancel()
			await vi.advanceTimersByTimeAsync(1000)
			expect(fired).toBe(false)
			expect(vi.getTimerCount()).toBe(0)
		} finally {
			vi.useRealTimers()
		}
	})
})

describe('loadingHints', () => {
	it('is eager, sync and high only with priority', () => {
		expect(loadingHints(true)).toEqual({
			loading: 'eager',
			decoding: 'sync',
			fetchpriority: 'high'
		})
		expect(loadingHints(false)).toEqual({ loading: 'lazy', decoding: 'async' })
		expect(loadingHints(undefined)).toEqual({ loading: 'lazy', decoding: 'async' })
	})
})

describe('responsiveWidths', () => {
	it('matches known ladders', () => {
		expect(responsiveWidths(1200)).toEqual(SERVED_WIDTHS)
		expect(responsiveWidths(100)).toEqual([100])
		expect(responsiveWidths(320)).toEqual([320])
		expect(responsiveWidths(2600)).toEqual([...LADDER, 2600])
		expect(responsiveWidths(900, [1000, 300, 600])).toEqual([300, 600, 900])
		expect(responsiveWidths(600, [600, 300])).toEqual([300, 600])
		expect(responsiveWidths(700, [])).toEqual([320, 480, 640, 700])
	})

	it('holds every rung below the width and ends at the width, for every width and ladder', () => {
		const ladders: (number[] | undefined)[] = [undefined, [], [1000, 300, 600, 300]]
		for (const ladder of ladders) {
			const rungs = ladder === undefined || ladder.length === 0 ? LADDER : ladder
			for (let width = 1; width <= 2600; width += 1) {
				const widths = responsiveWidths(width, ladder)
				expect(isAscending(widths)).toBe(true)
				expect(widths.at(-1)).toBe(width)
				expect(
					rungs.filter((rung) => rung < width).every((rung) => widths.includes(rung))
				).toBe(true)
				expect(widths.every((step) => step === width || rungs.includes(step))).toBe(true)
			}
		}
	})
})

describe('cappedWidths', () => {
	it('matches known requests', () => {
		expect(cappedWidths([400, 800], 1200)).toEqual([400, 800])
		expect(cappedWidths([300, 600, 1200], 300)).toEqual([300])
		expect(cappedWidths([100, 600], 300)).toEqual([100, 300])
		expect(cappedWidths([800, 400, 400], 1200)).toEqual([400, 800])
	})

	it('keeps every width up to the intrinsic one and adds it only when one was dropped, for every subset', () => {
		const candidates = [100, 300, 600, 1200]
		for (let mask = 0; mask < 2 ** candidates.length; mask += 1) {
			const widths = candidates.filter((_, index) => (mask >> index) & 1)
			for (const width of [100, 300, 500, 1200, 2000]) {
				const capped = cappedWidths(widths, width)
				const dropped = widths.some((step) => step > width)
				expect(isAscending(capped)).toBe(true)
				expect(capped.every((step) => step <= width)).toBe(true)
				expect(
					widths.filter((step) => step <= width).every((step) => capped.includes(step))
				).toBe(true)
				expect(capped.includes(width)).toBe(dropped || widths.includes(width))
			}
		}
	})
})

describe('responsiveProps', () => {
	const size: ImageSize = { width: 900, height: 600 }

	it('matches known requests', () => {
		const cases: ResponsiveCase[] = [
			{
				request: { optimizable: false, layout: 'constrained', widths: [100] },
				expected: { layout: 'none' }
			},
			{
				request: { optimizable: true },
				expected: { layout: 'constrained', widths: [320, 480, 640, 800, 900] }
			},
			{
				request: {
					optimizable: true,
					configLayout: 'full-width',
					breakpoints: [300, 3000]
				},
				expected: { layout: 'full-width', widths: [300, 900] }
			},
			{
				request: { optimizable: true, layout: 'fixed', configLayout: 'none' },
				expected: { layout: 'fixed', widths: [320, 480, 640, 800, 900] }
			},
			{ request: { optimizable: true, configLayout: 'none' }, expected: { layout: 'none' } },
			{
				request: { optimizable: true, layout: 'none', widths: [100, 2000] },
				expected: { layout: 'none', widths: [100, 900] }
			}
		]
		for (const { request, expected } of cases) {
			expect(responsiveProps(size, request)).toEqual(expected)
		}
	})

	it('never goes past the intrinsic width and is never responsive off the allowed hosts', () => {
		for (const optimizable of [true, false]) {
			for (const layout of LAYOUTS) {
				for (const configLayout of LAYOUTS) {
					for (const widths of [undefined, [100, 200], [100, 2000]]) {
						for (const breakpoints of [undefined, [], [300, 600, 3000]]) {
							const props = responsiveProps(size, {
								optimizable,
								layout,
								configLayout,
								widths,
								breakpoints
							})
							if (!optimizable) {
								expect(props).toEqual({ layout: 'none' })
								continue
							}
							expect(props.layout).toBe(layout ?? configLayout ?? 'constrained')
							expect((props.widths ?? []).every((step) => step <= size.width)).toBe(
								true
							)
							expect(props.widths === undefined).toBe(
								widths === undefined && props.layout === 'none'
							)
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
