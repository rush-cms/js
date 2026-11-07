const NON_TEXT = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g
const GLUED_INLINE = /\w<(?:code|a|span)[\s>]/g
const CONTEXT = 40

export function gluedText(html: string): string[] {
	const text = html.replace(NON_TEXT, '')
	return [...text.matchAll(GLUED_INLINE)].map((match) =>
		text.slice(Math.max(0, match.index - CONTEXT), match.index + match[0].length)
	)
}
