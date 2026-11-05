import type { AstroComponentFactory } from 'astro/runtime/server/index.js'
import RichTextCodeBlock from './rich-text-code-block.astro'
import RichTextCustomBlock from './rich-text-custom-block.astro'
import RichTextElement from './rich-text-element.astro'
import RichTextFigure from './rich-text-figure.astro'
import RichTextGallery from './rich-text-gallery.astro'
import RichTextText from './rich-text-text.astro'

export const RENDERERS: Record<string, AstroComponentFactory> = {
	text: RichTextText,
	paragraph: RichTextElement,
	heading: RichTextElement,
	bulletList: RichTextElement,
	orderedList: RichTextElement,
	listItem: RichTextElement,
	blockquote: RichTextElement,
	hardBreak: RichTextElement,
	horizontalRule: RichTextElement,
	codeBlock: RichTextCodeBlock,
	image: RichTextFigure,
	gallery: RichTextGallery,
	customBlock: RichTextCustomBlock
}
