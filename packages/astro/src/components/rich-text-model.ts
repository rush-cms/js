import type { components } from '@rushcms/client'
import { isRecord } from '@rushcms/client/internal'
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
	depth: number
}

export type ResolvedImage = RichTextMedia & {
	url: string
	alt: string
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

export function positive(value: unknown): number | undefined {
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

const SAFE_SCHEMES: readonly string[] = ['http', 'https', 'mailto', 'tel']
const TARGETS: readonly string[] = ['_blank', '_self', '_parent', '_top']
const SCHEME_PREFIX = /^([^/?#]*):/

function visibleCharacters(value: string): string {
	return Array.from(value)
		.filter((character) => {
			const code = character.codePointAt(0) ?? 0
			return code > 0x20 && (code < 0x7f || code > 0x9f)
		})
		.join('')
}

export function isSafeHref(href: string): boolean {
	const scheme = SCHEME_PREFIX.exec(visibleCharacters(href))?.[1]
	return scheme === undefined || SAFE_SCHEMES.includes(scheme.toLowerCase())
}

export function linkAttributes(mark: RichTextMark): LinkAttributes | undefined {
	const attrs = isRecord(mark.attrs) ? mark.attrs : {}
	const href = text(attrs.href)
	if (href === '' || !isSafeHref(href)) {
		return undefined
	}
	const requested = text(attrs.target)
	const target = TARGETS.includes(requested) ? requested : undefined
	const rel = target === '_blank' ? 'noopener noreferrer' : undefined
	return { href, target, rel }
}

export function resolveImage(
	reference: ImageReference,
	media: MediaMap
): ResolvedImage | undefined {
	const mediaId = text(reference.mediaId)
	const entry = mediaId === '' ? undefined : media[mediaId]
	const url = text(entry?.url) || text(reference.src)
	if (url === '') {
		return undefined
	}
	const width = positive(entry?.width)
	const height = positive(entry?.height)
	return {
		url,
		alt: text(reference.alt) || text(entry?.alt),
		...(width === undefined || height === undefined ? {} : { width, height })
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

export const MAX_DEPTH = 32

const ELEMENT_TAGS: Record<string, string> = {
	paragraph: 'p',
	bulletList: 'ul',
	orderedList: 'ol',
	listItem: 'li',
	blockquote: 'blockquote',
	hardBreak: 'br',
	horizontalRule: 'hr'
}

export function elementTag(node: RichTextContent): string {
	return node.type === 'heading' ? headingTag(node) : (ELEMENT_TAGS[node.type] ?? 'div')
}
