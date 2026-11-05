import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, posix } from 'node:path'

type ExportTarget = string | { [condition: string]: ExportTarget } | null

type PackageManifest = {
	name: string
	private?: boolean
	exports?: Record<string, ExportTarget>
}

type PackReport = {
	files: { path: string }[]
}

const PACKAGES_DIR = join(import.meta.dirname, '../packages')
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

function targetsOf(target: ExportTarget, wildcard: string): string[] {
	if (target === null) {
		return []
	}
	if (typeof target === 'string') {
		return [posix.normalize(target.replace('*', wildcard))]
	}
	return Object.values(target).flatMap((nested) => targetsOf(nested, wildcard))
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

function selfReferenceProblems(
	manifest: PackageManifest,
	specifier: string,
	files: Set<string>
): string[] {
	const subpath = `.${specifier.slice(manifest.name.length)}`
	for (const [key, target] of Object.entries(manifest.exports ?? {})) {
		const wildcard = wildcardOf(key, subpath)
		if (wildcard !== undefined) {
			const missing = targetsOf(target, wildcard).filter((path) => !files.has(path))
			return missing.map((path) => `export "${key}" target ${path} is not in the tarball`)
		}
	}
	return [`"${specifier}" matches no export of ${manifest.name}`]
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
		const isSelf = specifier === manifest.name || specifier.startsWith(`${manifest.name}/`)
		return isSelf ? selfReferenceProblems(manifest, specifier, files) : []
	})
}

function checkPackage(dir: string): string[] {
	const manifest = manifestOf(dir)
	if (manifest.private === true) {
		return []
	}
	const files = packedFiles(dir)
	return [...files]
		.filter((file) => CHECKED.test(file) && existsSync(join(dir, file)))
		.flatMap((file) =>
			problemsOf(manifest, dir, file, files).map(
				(problem) => `${manifest.name}: ${file}: ${problem}`
			)
		)
}

const dirs = readdirSync(PACKAGES_DIR).map((name) => join(PACKAGES_DIR, name))
const problems = dirs.filter((dir) => existsSync(join(dir, 'package.json'))).flatMap(checkPackage)

if (problems.length > 0) {
	console.error(problems.join('\n'))
	process.exit(1)
}
console.log(`pack check passed for ${dirs.length} packages`)
