import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { isExcludedFromBundle } from '../../../scripts/bundle-template'
import { KEEP_NAMES, copyTree } from '../src/copy'
import type { PackageManager } from '../src/package-manager'
import type { CliIo } from '../src/types'

export type InstallCall = {
	packageManager: PackageManager
	cwd: string
}

export type RecordedIo = {
	io: CliIo
	out: string[]
	err: string[]
	installs: InstallCall[]
}

export const FIXTURE_TEMPLATE = join(import.meta.dirname, 'fixtures', 'template')

export const TEMPLATE_SOURCE = join(import.meta.dirname, '..', '..', '..', 'templates', 'astro')

const tempDirs: string[] = []

export function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'create-rush-cms-'))
	tempDirs.push(dir)
	return dir
}

export function removeTempDirs(): void {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true })
	}
}

export function recordIo(installExitCode = 0): RecordedIo {
	const out: string[] = []
	const err: string[] = []
	const installs: InstallCall[] = []
	const io: CliIo = {
		out: (line) => out.push(line),
		err: (line) => err.push(line),
		spawn: (packageManager, cwd) => {
			installs.push({ packageManager, cwd })
			return Promise.resolve(installExitCode)
		}
	}
	return { io, out, err, installs }
}

export function filesOf(root: string): string[] {
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => relative(root, join(entry.parentPath, entry.name)))
		.toSorted()
}

export function textOf(root: string, file: string): string {
	return readFileSync(join(root, file), 'utf8')
}

export function bundledTemplate(): string {
	const dir = makeTempDir()
	copyTree(TEMPLATE_SOURCE, dir, { skip: isExcludedFromBundle, rename: KEEP_NAMES })
	return dir
}
