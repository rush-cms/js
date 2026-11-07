import { sitePaths } from './site-pages'
import type { SiteStaticPath } from './site-pages'

export function getStaticPaths(): Promise<SiteStaticPath[]> {
	return sitePaths()
}
