import { isRemoteAllowed } from 'astro/assets/utils'
import type { RemotePattern } from 'astro/assets/utils'
import type { HTMLAttributes } from 'astro/types'
import { positive } from './rich-text-model'
import type { RichTextMedia } from './rich-text-model'

export type ImageLayout = 'constrained' | 'fixed' | 'full-width' | 'none'

export type ImageSize = {
	width: number
	height: number
}

export type SizeProbe = (url: string) => Promise<ImageSize>

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

export const WIDTH_LADDER: readonly number[] = [320, 480, 640, 800, 1024, 1280, 1600, 1920]

const probes = new Map<string, Promise<ImageSize | undefined>>()

export function sizeOf(width: unknown, height: unknown): ImageSize | undefined {
	const w = positive(width)
	const h = positive(height)
	return w === undefined || h === undefined ? undefined : { width: w, height: h }
}

export function probeOnce(url: string, probe: SizeProbe): Promise<ImageSize | undefined> {
	const known = probes.get(url)
	if (known !== undefined) {
		return known
	}
	const pending = Promise.resolve()
		.then(() => probe(url))
		.then(
			(size) => sizeOf(size.width, size.height),
			() => undefined
		)
		.then((size) => {
			if (size === undefined) {
				probes.delete(url)
			}
			return size
		})
	probes.set(url, pending)
	return pending
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

export function responsiveWidths(
	width: number,
	ladder: readonly number[] = WIDTH_LADDER
): number[] {
	return [...new Set([...ladder.filter((step) => step < width), width])].sort((a, b) => a - b)
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
		return { layout, widths: request.widths }
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
