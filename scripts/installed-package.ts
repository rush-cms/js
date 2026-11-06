import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { literalTargets } from './export-targets'
import type { PackageManifest } from './export-targets'

export type InstalledPackage = {
	resolve(specifier: string): string
	remove(): void
}

function install(site: string, manifest: PackageManifest): string {
	const packageDir = join(site, 'node_modules', manifest.name)
	mkdirSync(packageDir, { recursive: true })
	writeFileSync(join(packageDir, 'package.json'), JSON.stringify(manifest))
	for (const file of literalTargets(manifest)) {
		mkdirSync(dirname(join(packageDir, file)), { recursive: true })
		writeFileSync(join(packageDir, file), '')
	}
	return packageDir
}

export function installedPackage(manifestPath: string): InstalledPackage {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageManifest
	const site = mkdtempSync(join(tmpdir(), 'rush-installed-'))
	const remove = (): void => rmSync(site, { recursive: true, force: true })
	try {
		const packageDir = install(site, manifest)
		const siteRequire = createRequire(join(site, 'package.json'))
		return {
			resolve: (specifier) => relative(packageDir, siteRequire.resolve(specifier)),
			remove
		}
	} catch (err) {
		remove()
		throw err
	}
}
