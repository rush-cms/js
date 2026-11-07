import { afterEach, describe, expect, it } from 'vitest'
import { changesetProblems, parseChangeset, readChangesets } from '../check-changesets'
import type { ChangesetFile } from '../check-changesets'
import { makeTempDir, removeTempDirs, writeFiles } from './support'

const CLIENT = '@rushcms/client'
const ASTRO = '@rushcms/astro'
const CREATE = 'create-rush-cms'
const NAMES = [CLIENT, ASTRO, CREATE]
const MAX_FILES = 3

afterEach(removeTempDirs)

function file(name: string, ...releases: string[]): ChangesetFile {
	return { name, releases }
}

function subsetsOf(names: string[]): string[][] {
	return names.reduce<string[][]>(
		(subsets, name) => [...subsets, ...subsets.map((subset) => [...subset, name])],
		[[]]
	)
}

function extend(sequences: ChangesetFile[][], alphabet: string[][]): ChangesetFile[][] {
	return sequences.flatMap((sequence) =>
		alphabet.map((releases) => [...sequence, file(`f${sequence.length}.md`, ...releases)])
	)
}

function allSequences(alphabet: string[][], maxLength: number): ChangesetFile[][] {
	let layer: ChangesetFile[][] = [[]]
	const all = [...layer]
	for (let length = 1; length <= maxLength; length++) {
		layer = extend(layer, alphabet)
		all.push(...layer)
	}
	return all
}

function expectedFlagged(files: ChangesetFile[]): string[] {
	const released = new Set(files.flatMap((entry) => entry.releases))
	if (released.has(CREATE)) {
		return []
	}
	return files
		.filter((entry) => entry.releases.includes(CLIENT) || entry.releases.includes(ASTRO))
		.map((entry) => entry.name)
}

describe('changesetProblems table', () => {
	it.each([
		['no changesets', [], 0],
		['create only', [file('a.md', CREATE)], 0],
		['client only', [file('a.md', CLIENT)], 1],
		['astro only', [file('a.md', ASTRO)], 1],
		['client and astro without create', [file('a.md', CLIENT, ASTRO)], 1],
		['client and create in one file', [file('a.md', CLIENT, CREATE)], 0],
		['astro and create in one file', [file('a.md', ASTRO, CREATE)], 0],
		['client and create in separate files', [file('a.md', CLIENT), file('b.md', CREATE)], 0],
		['two SDK files without create', [file('a.md', CLIENT), file('b.md', ASTRO)], 2],
		['unrelated package only', [file('a.md', 'other')], 0],
		['empty changeset', [file('a.md')], 0]
	])('%s', (_label, files, count) => {
		expect(changesetProblems(files)).toHaveLength(count)
	})

	it('names the offending changeset file', () => {
		expect(changesetProblems([file('brave-lions.md', ASTRO)])[0]).toContain('brave-lions.md')
	})
})

describe('changesetProblems generated', () => {
	const cases = allSequences(subsetsOf(NAMES), MAX_FILES)

	it('covers every combination of three packages across zero to three files', () => {
		expect(cases).toHaveLength(1 + 8 + 64 + 512)
	})

	it('flags exactly the files that release an SDK package without create', () => {
		for (const files of cases) {
			const flagged = changesetProblems(files).map((problem) => problem.split(' ')[0])
			expect(flagged, JSON.stringify(files)).toEqual(expectedFlagged(files))
		}
	})
})

describe('reading changesets', () => {
	it('reads the package names from frontmatter', () => {
		const text = `---\n"@rushcms/client": major\n'create-rush-cms': minor\n---\n\nNotes\n`
		expect(parseChangeset('a.md', text)).toEqual({ name: 'a.md', releases: [CLIENT, CREATE] })
	})

	it('treats an empty changeset as releasing nothing', () => {
		expect(parseChangeset('a.md', '---\n---\n\nNotes\n').releases).toEqual([])
	})

	it('reads every markdown file except the README', () => {
		const dir = makeTempDir()
		writeFiles(dir, {
			'a.md': `---\n"${ASTRO}": minor\n---\n\nA\n`,
			'README.md': '# Changesets\n',
			'config.json': '{}'
		})
		expect(readChangesets(dir)).toEqual([{ name: 'a.md', releases: [ASTRO] }])
	})
})
