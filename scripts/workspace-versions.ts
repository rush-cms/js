import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export type WorkspaceManifest = {
	name: string
	version: string
}

export function workspaceVersions(root: string): Map<string, string> {
	const packagesDir = join(root, 'packages')
	const versions = new Map<string, string>()
	for (const dir of readdirSync(packagesDir)) {
		const manifest = JSON.parse(
			readFileSync(join(packagesDir, dir, 'package.json'), 'utf8')
		) as WorkspaceManifest
		versions.set(manifest.name, manifest.version)
	}
	return versions
}

export const BUNDLING_PACKAGE = 'create-rush-cms'
