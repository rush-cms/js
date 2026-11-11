import { isRemoteAllowed } from 'astro/assets/utils'
import type { RemotePattern } from 'astro/assets/utils'
import type { HTMLAttributes } from 'astro/types'
import { positive, sizeOf } from './media-size'
import type { ImageSize } from './media-size'
import type { RichTextMedia } from './rich-text-model'

export type { ImageSize } from './media-size'

export type ImageLayout = 'constrained' | 'fixed' | 'full-width' | 'none'

export type SizeProbe = (url: string) => Promise<ImageSize>

export type ProbeDeadline = {
	expired: Promise<void>
	cancel(): void
}

export type DeadlineFactory = () => ProbeDeadline

export type LoadingHints = {
	loading: 'eager' | 'lazy'
	decoding: 'sync' | 'async'
	fetchpriority?: 'high'
}

export type SizeLookup = (url: string) => Promise<ImageSize | undefined>

export type SizedFrame = {
	kind: 'sized'
	url: string
	size: ImageSize
}

export type BoxedFrame = {
	kind: 'boxed'
	url: string
	aspectRatio: number
}

export type PlainFrame = {
	kind: 'plain'
	url: string
}

export type ImageFrame = SizedFrame | BoxedFrame | PlainFrame

export type ImageStyle = HTMLAttributes<'img'>['style']

export type ConfiguredPattern = {
	[Key in keyof RemotePattern]?: string | undefined
}

export type RemoteImageConfig = {
	domains?: string[] | undefined
	remotePatterns?: ConfiguredPattern[] | undefined
}

const PATTERN_KEYS: readonly (keyof RemotePattern)[] = ['protocol', 'hostname', 'port', 'pathname']

const WIDTH_LADDER: readonly number[] = [320, 480, 640, 800, 1024, 1280, 1600, 1920]

export const PROBE_TIMEOUT_MS = 8000

const probes = new Map<string, Promise<ImageSize | undefined>>()

export function probeDeadline(milliseconds: number = PROBE_TIMEOUT_MS): ProbeDeadline {
	let handle: ReturnType<typeof setTimeout> | undefined
	const expired = new Promise<void>((resolve) => {
		handle = setTimeout(resolve, milliseconds)
	})
	return { expired, cancel: () => clearTimeout(handle) }
}

async function boundedProbe(
	url: string,
	probe: SizeProbe,
	deadline: DeadlineFactory
): Promise<ImageSize | undefined> {
	const timer = deadline()
	const probed = Promise.resolve()
		.then(() => probe(url))
		.then(
			(size) => sizeOf(size.width, size.height),
			() => undefined
		)
	try {
		return await Promise.race([probed, timer.expired.then(() => undefined)])
	} finally {
		timer.cancel()
	}
}

export function probeOnce(
	url: string,
	probe: SizeProbe,
	deadline: DeadlineFactory = probeDeadline
): Promise<ImageSize | undefined> {
	const known = probes.get(url)
	if (known !== undefined) {
		return known
	}
	const pending = boundedProbe(url, probe, deadline)
	probes.set(url, pending)
	return pending
}

export function loadingHints(priority: boolean | undefined): LoadingHints {
	return priority === true
		? { loading: 'eager', decoding: 'sync', fetchpriority: 'high' }
		: { loading: 'lazy', decoding: 'async' }
}

export async function imageFrame(
	media: RichTextMedia | undefined,
	aspectRatio: unknown,
	lookup: SizeLookup
): Promise<ImageFrame | undefined> {
	const url = media?.url
	if (url === undefined || url === '') {
		return undefined
	}
	const size = sizeOf(media?.width, media?.height) ?? (await lookup(url))
	if (size !== undefined) {
		return { kind: 'sized', url, size }
	}
	const ratio = positive(aspectRatio)
	return ratio === undefined ? { kind: 'plain', url } : { kind: 'boxed', url, aspectRatio: ratio }
}

function remotePattern(pattern: ConfiguredPattern): RemotePattern {
	const result: RemotePattern = {}
	for (const key of PATTERN_KEYS) {
		const value = pattern[key]
		if (value !== undefined) {
			result[key] = value
		}
	}
	return result
}

export function isOptimizable(url: string, config: RemoteImageConfig): boolean {
	return isRemoteAllowed(url, {
		domains: config.domains ?? [],
		remotePatterns: (config.remotePatterns ?? []).map(remotePattern)
	})
}

function ascending(widths: number[]): number[] {
	return [...new Set(widths)].sort((a, b) => a - b)
}

export function responsiveWidths(width: number, ladder?: readonly number[]): number[] {
	const steps = ladder !== undefined && ladder.length > 0 ? ladder : WIDTH_LADDER
	return ascending([...steps.filter((step) => step < width), width])
}

export function cappedWidths(widths: readonly number[], width: number): number[] {
	const kept = widths.filter((step) => step <= width)
	return ascending(kept.length === widths.length ? kept : [...kept, width])
}

export type ResponsiveRequest = {
	optimizable: boolean
	layout?: ImageLayout | undefined
	widths?: number[] | undefined
	configLayout?: ImageLayout | undefined
	breakpoints?: readonly number[] | undefined
}

export type ResponsiveProps = {
	layout: ImageLayout
	widths?: number[]
}

export function responsiveProps(size: ImageSize, request: ResponsiveRequest): ResponsiveProps {
	if (!request.optimizable) {
		return { layout: 'none' }
	}
	const layout = request.layout ?? request.configLayout ?? 'constrained'
	if (request.widths !== undefined) {
		return { layout, widths: cappedWidths(request.widths, size.width) }
	}
	return layout === 'none'
		? { layout }
		: { layout, widths: responsiveWidths(size.width, request.breakpoints) }
}

export function boxStyle(aspectRatio: number, style: ImageStyle): ImageStyle {
	const box = `aspect-ratio: ${aspectRatio}`
	if (typeof style === 'string' && style.trim() !== '') {
		return `${box}; ${style}`
	}
	if (style !== null && typeof style === 'object') {
		return { 'aspect-ratio': String(aspectRatio), ...style }
	}
	return box
}
