export type PackageManager = 'npm' | 'bun'

export type SiteKey = 'a' | 'b'

export type ProjectSpec = {
	site: SiteKey
	dir: string
	manager: PackageManager
}

export const PROJECTS: ProjectSpec[] = [
	{ site: 'a', dir: 'npm-site', manager: 'npm' },
	{ site: 'b', dir: 'bun-site', manager: 'bun' }
]

export const LOCKFILES: Record<PackageManager, string> = {
	npm: 'package-lock.json',
	bun: 'bun.lock'
}

export const REGISTRY_PORT = 4873

export function projectOf(site: SiteKey): ProjectSpec {
	const spec = PROJECTS.find((project) => project.site === site)
	if (spec === undefined) {
		throw new Error(`no generated project for site ${site}`)
	}
	return spec
}
