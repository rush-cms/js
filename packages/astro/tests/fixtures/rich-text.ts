import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import RichText from '../../src/components/rich-text.astro'
import type { MediaMap, RichTextContent, RichTextDoc } from '../../src/components/rich-text-model'

export type RenderOptions = {
	media?: MediaMap
	blocks?: Record<string, AstroComponentFactory>
	nodes?: Record<string, AstroComponentFactory>
}

export function doc(...content: RichTextContent[]): RichTextDoc {
	return { type: 'doc', content }
}

export function paragraph(...content: RichTextContent[]): RichTextContent {
	return { type: 'paragraph', content }
}

export function text(
	value: string,
	marks: { type: string; attrs?: Record<string, unknown> }[] = []
) {
	return marks.length === 0 ? { type: 'text', text: value } : { type: 'text', text: value, marks }
}

export async function render(content: RichTextDoc, options: RenderOptions = {}): Promise<string> {
	const container = await AstroContainer.create()
	return container.renderToString(RichText, { props: { content, ...options } })
}
