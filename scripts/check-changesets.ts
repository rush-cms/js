import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { BUNDLING_PACKAGE } from './workspace-versions'

export type ChangesetFile = {
	name: string
	releases: string[]
}

const SDK_PACKAGES: ReadonlySet<string> = new Set(['@rushcms/client', '@rushcms/astro'])
const IGNORED_FILES: ReadonlySet<string> = new Set(['README.md'])
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/

export function changesetProblems(files: ChangesetFile[]): string[] {
	const releasesBundler = files.some((file) => file.releases.includes(BUNDLING_PACKAGE))
	if (releasesBundler) {
		return []
	}
	return files
		.filter((file) => file.releases.some((name) => SDK_PACKAGES.has(name)))
		.map(
			(file) =>
				`${file.name} releases an SDK package but no pending changeset releases ${BUNDLING_PACKAGE}`
		)
}

export function parseChangeset(name: string, text: string): ChangesetFile {
	const frontmatter = FRONTMATTER.exec(text)?.[1] ?? ''
	const parsed = parse(frontmatter) as Record<string, string> | null
	return { name, releases: Object.keys(parsed ?? {}) }
}

export function readChangesets(dir: string): ChangesetFile[] {
	return readdirSync(dir)
		.filter((name) => name.endsWith('.md') && !IGNORED_FILES.has(name))
		.map((name) => parseChangeset(name, readFileSync(join(dir, name), 'utf8')))
}

if (import.meta.main) {
	const problems = changesetProblems(
		readChangesets(resolve(import.meta.dirname, '../.changeset'))
	)
	if (problems.length > 0) {
		console.error(problems.join('\n'))
		process.exit(1)
	}
	console.log('changeset coupling check passed')
}
