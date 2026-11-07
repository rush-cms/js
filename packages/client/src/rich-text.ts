import { isRecord } from './json'
import type { RichText } from './types'

const DOCUMENT_KEYS: ReadonlySet<string> = new Set(['type', 'content'])

function isNode(value: unknown): boolean {
	return isRecord(value) && typeof value['type'] === 'string'
}

export function isRichText(value: unknown): value is RichText {
	if (!isRecord(value) || value['type'] !== 'doc') {
		return false
	}
	const { content } = value
	return (
		Object.keys(value).every((key) => DOCUMENT_KEYS.has(key)) &&
		(content === undefined || (Array.isArray(content) && content.every(isNode)))
	)
}
