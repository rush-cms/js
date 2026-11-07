import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

export type PackedPackage = {
	dir: string
	filename: string
}

export const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..')

export function workspacePackage(name: string, filename: string): PackedPackage {
	return { dir: resolve(REPOSITORY_ROOT, 'packages', name), filename }
}

export function packInto(packs: string, packages: PackedPackage[]): string[] {
	rmSync(packs, { recursive: true, force: true })
	mkdirSync(packs)
	return packages.map((pkg) => {
		const file = resolve(packs, pkg.filename)
		execFileSync('bun', ['pm', 'pack', '--filename', file, '--quiet'], {
			cwd: pkg.dir,
			stdio: 'inherit'
		})
		return file
	})
}
