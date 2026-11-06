import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'

type ExportTarget = string | { [condition: string]: ExportTarget } | null

type PackageManifest = {
	name: string
	exports: Record<string, ExportTarget>
}

export type InstalledPackage = {
	resolve(specifier: string): string
	remove(): void
}

const MANIFEST_PATH = join(import.meta.dirname, '../../package.json')

function targetsOf(target: ExportTarget): string[] {
	if (target === null) {
		return []
	}
	return typeof target === 'string' ? [target] : Object.values(target).flatMap(targetsOf)
}

export function installedPackage(): InstalledPackage {
	const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as PackageManifest
	const site = mkdtempSync(join(tmpdir(), 'rush-installed-'))
	const packageDir = join(site, 'node_modules', manifest.name)
	mkdirSync(packageDir, { recursive: true })
	writeFileSync(join(packageDir, 'package.json'), JSON.stringify(manifest))
	const files = Object.entries(manifest.exports)
		.filter(([key]) => !key.includes('*'))
		.flatMap(([, target]) => targetsOf(target))
	for (const file of files) {
		mkdirSync(dirname(join(packageDir, file)), { recursive: true })
		writeFileSync(join(packageDir, file), '')
	}
	const siteRequire = createRequire(join(site, 'package.json'))
	return {
		resolve: (specifier) => relative(packageDir, siteRequire.resolve(specifier)),
		remove: () => rmSync(site, { recursive: true, force: true })
	}
}
