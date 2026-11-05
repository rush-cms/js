import type { components } from '@rushcms/client'
import { isRecord } from '@rushcms/client'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'

type Schemas = components['schemas']

export type RichTextDoc = Schemas['RichText']
export type RichTextContent = Schemas['RichTextContent']
export type RichTextMark = Schemas['RichTextMark']
export type MediaMap = Schemas['MediaMap']
export type RichTextMedia = Schemas['Media']

export type BlockComponents = Record<string, AstroComponentFactory>
export type NodeComponents = Record<string, AstroComponentFactory>

export type RichTextContext = {
	media: MediaMap
	blocks: BlockComponents
	nodes: NodeComponents
}

export type ResolvedImage = {
	src: string
	alt: string
	width?: number | undefined
	height?: number | undefined
}

export type ImageReference = {
	src?: unknown
	alt?: unknown
	mediaId?: unknown
}

export type GalleryItem = ImageReference & {
	caption?: unknown
}

export type LinkAttributes = {
	href: string
	target?: string | undefined
	rel?: string | undefined
}

export type CustomBlockContent = {
	block: string
	values: Record<string, unknown>
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export type HeadingTag = `h${(typeof HEADING_LEVELS)[number]}`

function text(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

function positive(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function nodeAttrs(node: RichTextContent): Record<string, unknown> {
	return isRecord(node.attrs) ? node.attrs : {}
}

export function nodeChildren(node: RichTextContent): RichTextContent[] {
	return 'content' in node && Array.isArray(node.content) ? node.content : []
}

export function nodeMarks(node: RichTextContent): RichTextMark[] {
	return 'marks' in node && Array.isArray(node.marks) ? node.marks : []
}

export function nodeText(node: RichTextContent): string {
	return 'text' in node ? text(node.text) : ''
}

export function headingTag(node: RichTextContent): HeadingTag {
	const level = nodeAttrs(node).level
	const found = HEADING_LEVELS.find((candidate) => candidate === level)
	return `h${found ?? 2}`
}

export function orderedStart(node: RichTextContent): number | undefined {
	const start = nodeAttrs(node).start
	return typeof start === 'number' && Number.isInteger(start) && start !== 1 ? start : undefined
}

export function codeLanguage(node: RichTextContent): string | undefined {
	const language = text(nodeAttrs(node).language)
	return /^[A-Za-z0-9_+#.-]+$/.test(language) ? language : undefined
}

export function customBlockContent(node: RichTextContent): CustomBlockContent {
	const attrs = nodeAttrs(node)
	return { block: text(attrs.block), values: isRecord(attrs.values) ? attrs.values : {} }
}

export function linkAttributes(mark: RichTextMark): LinkAttributes | undefined {
	const attrs = isRecord(mark.attrs) ? mark.attrs : {}
	const href = text(attrs.href)
	if (href === '') {
		return undefined
	}
	const target = text(attrs.target) || undefined
	const rel = target === '_blank' ? 'noopener noreferrer' : text(attrs.rel) || undefined
	return { href, target, rel }
}

export function resolveImage(
	reference: ImageReference,
	media: MediaMap
): ResolvedImage | undefined {
	const mediaId = text(reference.mediaId)
	const entry = mediaId === '' ? undefined : media[mediaId]
	const src = text(entry?.url) || text(reference.src)
	if (src === '') {
		return undefined
	}
	return {
		src,
		alt: text(reference.alt) || text(entry?.alt),
		width: positive(entry?.width),
		height: positive(entry?.height)
	}
}

export function galleryItems(node: RichTextContent): GalleryItem[] {
	const images = nodeAttrs(node).images
	return Array.isArray(images) ? images.filter(isRecord) : []
}

export function galleryCaption(item: GalleryItem): string {
	return text(item.caption)
}

export function dataValue(value: unknown): string | undefined {
	const result = text(value)
	return result === '' ? undefined : result
}

const MARK_TAGS: Record<string, string> = {
	bold: 'strong',
	italic: 'em',
	strike: 's',
	underline: 'u',
	code: 'code',
	subscript: 'sub',
	superscript: 'sup',
	highlight: 'mark'
}

export function markTag(mark: RichTextMark): string | undefined {
	return Object.hasOwn(MARK_TAGS, mark.type) ? MARK_TAGS[mark.type] : undefined
}

export const KNOWN_NODE_TYPES: readonly string[] = [
	'text',
	'paragraph',
	'heading',
	'bulletList',
	'orderedList',
	'listItem',
	'blockquote',
	'codeBlock',
	'hardBreak',
	'horizontalRule',
	'image',
	'gallery',
	'customBlock'
]
