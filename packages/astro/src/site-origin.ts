export function requireSite(site: URL | undefined, subject: string): URL {
	if (site === undefined) {
		throw new Error(`@rushcms/astro: ${subject} needs "site" set in astro.config`)
	}
	return site
}

export function absoluteUrl(path: string, site: URL): string {
	return new URL(path, site).href
}
