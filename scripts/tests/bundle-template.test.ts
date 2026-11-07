import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bundleTemplate, isExcludedFromBundle } from '../bundle-template'
import { makeTempDir, removeTempDirs, writeFiles } from './support'

type DependencyMap = Record<string, string>

type BundledManifest = {
	name: string
	dependencies: DependencyMap
	devDependencies: DependencyMap
}

const TEMPLATE_MANIFEST = `{
  "name": "rush-cms-template-astro",
  "dependencies": {
    "@rushcms/astro": "workspace:*",
    "@rushcms/client": "workspace:*",
    "astro": "7.4.6"
  },
  "devDependencies": {
    "@rushcms/testing": "workspace:^",
    "typescript": "6.0.2"
  }
}
`

const WORKSPACE_FILES: Record<string, string> = {
	'packages/client/package.json': '{"name":"@rushcms/client","version":"3.1.0"}',
	'packages/astro/package.json': '{"name":"@rushcms/astro","version":"0.2.4"}',
	'packages/testing/package.json': '{"name":"@rushcms/testing","version":"1.0.0"}',
	'packages/create-rush-cms/package.json': '{"name":"create-rush-cms","version":"0.1.0"}',
	'templates/astro/package.json': TEMPLATE_MANIFEST,
	'templates/astro/_gitignore': 'node_modules\n',
	'templates/astro/.env.example': 'RUSH_API_URL=\n',
	'templates/astro/src/pages/index.astro': '<h1>home</h1>\n'
}

const EXCLUDED_FILES: Record<string, string> = {
	'templates/astro/.env': 'RUSH_API_TOKEN=secret\n',
	'templates/astro/.env.local': 'RUSH_API_TOKEN=secret\n',
	'templates/astro/node_modules/pkg/index.js': '',
	'templates/astro/dist/server/entry.mjs': '',
	'templates/astro/.astro/types.d.ts': '',
	'templates/astro/src/nested/node_modules/pkg/index.js': ''
}

afterEach(removeTempDirs)

function workspaceRoot(extra: Record<string, string> = {}): string {
	const root = makeTempDir()
	writeFiles(root, { ...WORKSPACE_FILES, ...extra })
	return root
}

function bundledDir(root: string): string {
	return join(root, 'packages', 'create-rush-cms', 'template')
}

function bundledText(root: string): string {
	return readFileSync(join(bundledDir(root), 'package.json'), 'utf8')
}

function bundledManifest(root: string): BundledManifest {
	return JSON.parse(bundledText(root)) as BundledManifest
}

function listFiles(dir: string, prefix = ''): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? listFiles(join(dir, entry.name), `${prefix}${entry.name}/`)
			: [`${prefix}${entry.name}`]
	)
}

describe('bundleTemplate pinning', () => {
	it('replaces every workspace dependency with the exact package version', () => {
		const root = workspaceRoot()
		bundleTemplate(root)
		const manifest = bundledManifest(root)
		expect(manifest.dependencies).toEqual({
			'@rushcms/astro': '0.2.4',
			'@rushcms/client': '3.1.0',
			astro: '7.4.6'
		})
		expect(manifest.devDependencies).toEqual({
			'@rushcms/testing': '1.0.0',
			typescript: '6.0.2'
		})
	})

	it('leaves no workspace: specifier in the bundled manifest', () => {
		const root = workspaceRoot()
		bundleTemplate(root)
		expect(bundledText(root)).not.toContain('workspace:')
	})

	it('keeps the source indentation and does not touch the source manifest', () => {
		const root = workspaceRoot()
		bundleTemplate(root)
		expect(bundledText(root)).toContain('\n  "name"')
		expect(readFileSync(join(root, 'templates', 'astro', 'package.json'), 'utf8')).toBe(
			TEMPLATE_MANIFEST
		)
	})

	it('fails when a workspace dependency has no matching package', () => {
		const root = workspaceRoot({
			'templates/astro/package.json': '{"dependencies":{"@rushcms/missing":"workspace:*"}}'
		})
		expect(() => bundleTemplate(root)).toThrow('@rushcms/missing')
	})
})

describe('bundleTemplate exclusions', () => {
	it('copies the template without excluded paths and keeps the examples', () => {
		const root = workspaceRoot(EXCLUDED_FILES)
		bundleTemplate(root)
		expect(listFiles(bundledDir(root)).sort()).toEqual([
			'.env.example',
			'_gitignore',
			'package.json',
			'src/pages/index.astro'
		])
	})

	it('keeps _gitignore under its template name', () => {
		const root = workspaceRoot()
		bundleTemplate(root)
		expect(existsSync(join(bundledDir(root), '_gitignore'))).toBe(true)
		expect(existsSync(join(bundledDir(root), '.gitignore'))).toBe(false)
	})

	it('replaces a previous bundle instead of merging into it', () => {
		const root = workspaceRoot({ 'packages/create-rush-cms/template/stale.txt': 'old' })
		bundleTemplate(root)
		expect(existsSync(join(bundledDir(root), 'stale.txt'))).toBe(false)
	})

	it.each(['node_modules', 'dist', '.astro', '.env', '.env.local', '.env.production'])(
		'excludes %s',
		(name) => {
			expect(isExcludedFromBundle(name)).toBe(true)
		}
	)

	it.each(['.env.example', '_gitignore', 'package.json', 'src', 'environment.ts'])(
		'includes %s',
		(name) => {
			expect(isExcludedFromBundle(name)).toBe(false)
		}
	)
})
