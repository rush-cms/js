export function toBcp47(code: string): string {
	return code.replaceAll('_', '-')
}
