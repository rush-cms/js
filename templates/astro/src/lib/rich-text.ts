import type { components } from '@rushcms/client'

export type RichTextDocument = components['schemas']['RichText']

export function isRichText(value: unknown): value is RichTextDocument {
	return typeof value === 'object' && value !== null && 'type' in value && value.type === 'doc'
}
