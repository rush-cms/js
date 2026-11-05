export function sameOriginUrl(value: string | null, origin: URL, base?: URL): URL | undefined {
	if (value === null || !URL.canParse(value, base)) {
		return undefined
	}
	const target = new URL(value, base)
	return target.origin === origin.origin ? target : undefined
}
