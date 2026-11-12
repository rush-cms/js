import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, posix, resolve } from 'node:path'
import { DEPENDENCY_FIELDS, WORKSPACE_PREFIX, isExcludedFromBundle } from './bundle-template'
import { literalTargets, targetsOf } from './export-targets'
import type { ExportTarget, PackageManifest } from './export-targets'
import { BUNDLING_PACKAGE, workspaceVersions } from './workspace-versions'

type PackReport = {
	files: { path: string }[]
}

type DependencyMap = Record<string, string>

type TemplateManifest = Partial<Record<string, DependencyMap>>

const ROOT = resolve(import.meta.dirname, '..')
const PACKAGES_DIR = join(ROOT, 'packages')
const ROOT_LICENSE = join(ROOT, 'LICENSE')
const VERSIONS = workspaceVersions(ROOT)
const TEMPLATE_DIR = 'template/'
const TEMPLATE_MANIFEST = `${TEMPLATE_DIR}package.json`
const RELEASE_FILES = ['README.md', 'LICENSE']
const CHECKED = /\.(js|mjs|ts|astro)$/
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g
const RESOLVED_SUFFIXES = ['', '.js', '.mjs', '.ts', '.d.ts', '.astro', '/index.js', '/index.ts']

function manifestOf(dir: string): PackageManifest {
	return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageManifest
}

function packedFiles(dir: string): Set<string> {
	const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
		cwd: dir,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	})
	const [report] = JSON.parse(output) as PackReport[]
	return new Set((report?.files ?? []).map((file) => file.path))
}

function wildcardOf(key: string, subpath: string): string | undefined {
	if (!key.includes('*')) {
		return key === subpath ? '' : undefined
	}
	const [head = '', tail = ''] = key.split('*')
	return subpath.startsWith(head) && subpath.endsWith(tail)
		? subpath.slice(head.length, subpath.length - tail.length)
		: undefined
}

function mappedProblems(
	table: Record<string, ExportTarget> | undefined,
	subpath: string,
	files: Set<string>
): string[] | undefined {
	for (const [key, target] of Object.entries(table ?? {})) {
		const wildcard = wildcardOf(key, subpath)
		if (wildcard !== undefined) {
			const missing = targetsOf(target, wildcard).filter((path) => !files.has(path))
			return missing.map((path) => `"${key}" target ${path} is not in the tarball`)
		}
	}
	return undefined
}

function selfReferenceProblems(
	manifest: PackageManifest,
	specifier: string,
	files: Set<string>
): string[] {
	const subpath = `.${specifier.slice(manifest.name.length)}`
	return (
		mappedProblems(manifest.exports, subpath, files) ?? [
			`"${specifier}" matches no export of ${manifest.name}`
		]
	)
}

function privateImportProblems(
	manifest: PackageManifest,
	specifier: string,
	files: Set<string>
): string[] {
	return (
		mappedProblems(manifest.imports, specifier, files) ?? [
			`"${specifier}" matches no import of ${manifest.name}`
		]
	)
}

function relativeProblem(file: string, specifier: string, files: Set<string>): string[] {
	const base = posix.join(posix.dirname(file), specifier)
	const declaration = base.replace(/\.js$/, '.d.ts')
	return files.has(declaration) ||
		RESOLVED_SUFFIXES.some((suffix) => files.has(`${base}${suffix}`))
		? []
		: [`"${specifier}" does not resolve inside the tarball`]
}

function problemsOf(
	manifest: PackageManifest,
	dir: string,
	file: string,
	files: Set<string>
): string[] {
	const source = readFileSync(join(dir, file), 'utf8')
	const specifiers = [...source.matchAll(SPECIFIER)].map((match) => match[1] ?? '')
	return specifiers.flatMap((specifier) => {
		if (specifier.startsWith('.')) {
			return relativeProblem(file, specifier, files)
		}
		if (specifier.startsWith('#')) {
			return privateImportProblems(manifest, specifier, files)
		}
		const isSelf = specifier === manifest.name || specifier.startsWith(`${manifest.name}/`)
		return isSelf ? selfReferenceProblems(manifest, specifier, files) : []
	})
}

function exportProblems(manifest: PackageManifest, files: Set<string>): string[] {
	return literalTargets(manifest)
		.filter((path) => !files.has(path))
		.map((path) => `${manifest.name}: export target ${path} is not in the tarball`)
}

function releaseFileProblems(manifest: PackageManifest, dir: string, files: Set<string>): string[] {
	const missing = RELEASE_FILES.filter((file) => !files.has(file)).map(
		(file) => `${manifest.name}: ${file} is not in the tarball`
	)
	const license = join(dir, 'LICENSE')
	const differs =
		existsSync(license) && readFileSync(license, 'utf8') !== readFileSync(ROOT_LICENSE, 'utf8')
	return differs
		? [...missing, `${manifest.name}: LICENSE differs from the root LICENSE`]
		: missing
}

function pinProblems(dir: string): string[] {
	const template = JSON.parse(
		readFileSync(join(dir, TEMPLATE_MANIFEST), 'utf8')
	) as TemplateManifest
	return DEPENDENCY_FIELDS.flatMap((field) =>
		Object.entries(template[field] ?? {}).flatMap(([name, range]) => {
			const expected = VERSIONS.get(name)
			if (range.startsWith(WORKSPACE_PREFIX)) {
				return [`${TEMPLATE_MANIFEST}: ${name} is ${range}`]
			}
			return expected !== undefined && range !== expected
				? [`${TEMPLATE_MANIFEST}: ${name} is ${range}, expected ${expected}`]
				: []
		})
	)
}

function bundledTemplateProblems(
	manifest: PackageManifest,
	dir: string,
	files: Set<string>
): string[] {
	if (manifest.name !== BUNDLING_PACKAGE) {
		return []
	}
	if (!files.has(TEMPLATE_MANIFEST)) {
		return [`${manifest.name}: ${TEMPLATE_MANIFEST} is not in the tarball`]
	}
	const leaked = [...files]
		.filter(
			(file) => file.startsWith(TEMPLATE_DIR) && file.split('/').some(isExcludedFromBundle)
		)
		.map((file) => `${manifest.name}: ${file} must not be in the tarball`)
	return [...pinProblems(dir).map((problem) => `${manifest.name}: ${problem}`), ...leaked]
}

function checkPackage(dir: string): string[] {
	const manifest = manifestOf(dir)
	if (manifest.private === true) {
		return []
	}
	const files = packedFiles(dir)
	const referenced = [...files]
		.filter((file) => CHECKED.test(file) && existsSync(join(dir, file)))
		.flatMap((file) =>
			problemsOf(manifest, dir, file, files).map(
				(problem) => `${manifest.name}: ${file}: ${problem}`
			)
		)
	return [
		...releaseFileProblems(manifest, dir, files),
		...exportProblems(manifest, files),
		...bundledTemplateProblems(manifest, dir, files),
		...referenced
	]
}

const dirs = readdirSync(PACKAGES_DIR).map((name) => join(PACKAGES_DIR, name))
const problems = dirs.filter((dir) => existsSync(join(dir, 'package.json'))).flatMap(checkPackage)

if (problems.length > 0) {
	console.error(problems.join('\n'))
	process.exit(1)
}
console.log(`pack check passed for ${dirs.length} packages`)
