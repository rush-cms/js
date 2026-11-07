import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { KEEP_NAMES, copyTree } from '../packages/create-rush-cms/src/copy'
import type { CopyRules } from '../packages/create-rush-cms/src/copy'
import { updateManifest } from '../packages/create-rush-cms/src/manifest'
import { workspaceVersions } from './workspace-versions'

type DependencyMap = Record<string, string>

const EXCLUDED_NAMES: ReadonlySet<string> = new Set(['node_modules', 'dist', '.astro', '.env'])
const ENV_EXAMPLE = '.env.example'
const ENV_PREFIX = '.env.'
export const WORKSPACE_PREFIX = 'workspace:'
export const DEPENDENCY_FIELDS = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies'
]

export function isExcludedFromBundle(name: string): boolean {
	return EXCLUDED_NAMES.has(name) || (name.startsWith(ENV_PREFIX) && name !== ENV_EXAMPLE)
}

const BUNDLE_RULES: CopyRules = { skip: isExcludedFromBundle, rename: KEEP_NAMES }

function pinned(field: DependencyMap, versions: Map<string, string>): DependencyMap {
	return Object.fromEntries(
		Object.entries(field).map(([name, range]) => {
			if (!range.startsWith(WORKSPACE_PREFIX)) {
				return [name, range]
			}
			const version = versions.get(name)
			if (version === undefined) {
				throw new Error(`${name} is a workspace dependency but no package has that name`)
			}
			return [name, version]
		})
	)
}

function pinManifest(file: string, versions: Map<string, string>): void {
	updateManifest(file, (manifest) => {
		for (const field of DEPENDENCY_FIELDS) {
			const dependencies = manifest[field]
			if (dependencies !== undefined) {
				manifest[field] = pinned(dependencies as DependencyMap, versions)
			}
		}
	})
}

export function bundleTemplate(root: string): void {
	const target = join(root, 'packages', 'create-rush-cms', 'template')
	rmSync(target, { recursive: true, force: true })
	copyTree(join(root, 'templates', 'astro'), target, BUNDLE_RULES)
	pinManifest(join(target, 'package.json'), workspaceVersions(root))
}

if (import.meta.main) {
	bundleTemplate(resolve(import.meta.dirname, '..'))
}
