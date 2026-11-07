import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { run } from '../src/run'
import type { CliEnv } from '../src/types'
import { FIXTURE_TEMPLATE, makeTempDir, recordIo, removeTempDirs } from './support'
import type { RecordedIo } from './support'

const BUN_AGENT = 'bun/1.4.4 npm/? node/v24.3.0 linux x64'

type Execution = {
	code: number
	cwd: string
	recorded: RecordedIo
}

type ExecuteOptions = {
	userAgent?: string
	installExitCode?: number
	cwd?: string
}

type PackageJson = {
	name: string
	scripts: Record<string, string>
}

afterEach(removeTempDirs)

async function execute(argv: string[], options: ExecuteOptions = {}): Promise<Execution> {
	const cwd = options.cwd ?? makeTempDir()
	const recorded = recordIo(options.installExitCode)
	const env: CliEnv = { userAgent: options.userAgent, cwd }
	const code = await run(argv, env, recorded.io, FIXTURE_TEMPLATE)
	return { code, cwd, recorded }
}

function packageJsonOf(dir: string): PackageJson {
	return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as PackageJson
}

describe('usage', () => {
	it('prints usage and exits 0 for --help', async () => {
		const { code, recorded } = await execute(['--help'])
		expect(code).toBe(0)
		expect(recorded.out.join('\n')).toContain('create-rush-cms <dir>')
		expect(recorded.err).toEqual([])
	})

	it('prints usage and exits 1 when the directory is missing', async () => {
		const { code, recorded } = await execute([])
		expect(code).toBe(1)
		expect(recorded.err.join('\n')).toContain('create-rush-cms <dir>')
		expect(recorded.installs).toEqual([])
	})

	it('prints usage and exits 1 for an unknown flag', async () => {
		const { code, cwd, recorded } = await execute(['site', '--frobnicate'])
		expect(code).toBe(1)
		expect(recorded.err.join('\n')).toContain('--frobnicate')
		expect(recorded.err.join('\n')).toContain('create-rush-cms <dir>')
		expect(existsSync(join(cwd, 'site'))).toBe(false)
	})

	it('exits 1 when more than one directory is given', async () => {
		const { code, cwd } = await execute(['one', 'two'])
		expect(code).toBe(1)
		expect(readdirSync(cwd)).toEqual([])
	})
})

describe('target directory', () => {
	it('exits 1 and writes nothing into a non-empty directory', async () => {
		const cwd = makeTempDir()
		const target = join(cwd, 'site')
		mkdirSync(target)
		writeFileSync(join(target, 'keep.txt'), 'mine')
		const { code, recorded } = await execute(['site'], { cwd })
		expect(code).toBe(1)
		expect(readdirSync(target)).toEqual(['keep.txt'])
		expect(recorded.err.join('\n')).toContain('not empty')
		expect(recorded.installs).toEqual([])
	})

	it('exits 1 when the target is a file', async () => {
		const cwd = makeTempDir()
		writeFileSync(join(cwd, 'site'), 'a file')
		const { code } = await execute(['site'], { cwd })
		expect(code).toBe(1)
		expect(readFileSync(join(cwd, 'site'), 'utf8')).toBe('a file')
	})

	it('accepts an existing empty directory', async () => {
		const cwd = makeTempDir()
		mkdirSync(join(cwd, 'site'))
		const { code } = await execute(['site'], { cwd })
		expect(code).toBe(0)
		expect(existsSync(join(cwd, 'site', 'package.json'))).toBe(true)
	})

	it('resolves the directory against the working directory', async () => {
		const { code, cwd } = await execute(['nested/My Site', '--no-install'])
		expect(code).toBe(0)
		expect(packageJsonOf(join(cwd, 'nested', 'My Site')).name).toBe('my-site')
	})
})

describe('scaffolding', () => {
	it('writes .gitignore, .env and the package name, and installs with bun for a bun user agent', async () => {
		const { code, cwd, recorded } = await execute(['Meu Site'], { userAgent: BUN_AGENT })
		const target = join(cwd, 'Meu Site')
		expect(code).toBe(0)
		expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('node_modules')
		expect(existsSync(join(target, '_gitignore'))).toBe(false)
		expect(readFileSync(join(target, '.env'), 'utf8')).toBe(
			readFileSync(join(target, '.env.example'), 'utf8')
		)
		expect(packageJsonOf(target).name).toBe('meu-site')
		expect(recorded.installs).toEqual([{ packageManager: 'bun', cwd: target }])
	})

	it('keeps the rest of package.json and its indentation', async () => {
		const { cwd } = await execute(['site', '--no-install'])
		const text = readFileSync(join(cwd, 'site', 'package.json'), 'utf8')
		expect(text).toContain('\n\t"private": true')
		expect(packageJsonOf(join(cwd, 'site')).scripts).toEqual({ dev: 'astro dev' })
		expect(text.endsWith('}\n')).toBe(true)
	})

	it('installs with npm when no user agent is present', async () => {
		const { recorded, cwd } = await execute(['site'])
		expect(recorded.installs).toEqual([{ packageManager: 'npm', cwd: join(cwd, 'site') }])
	})

	it('skips the install with --no-install', async () => {
		const { code, cwd, recorded } = await execute(['site', '--no-install'], {
			userAgent: BUN_AGENT
		})
		expect(code).toBe(0)
		expect(recorded.installs).toEqual([])
		expect(existsSync(join(cwd, 'site', '.env'))).toBe(true)
	})
})

describe('install failure', () => {
	it('prints the manual command, exits 1 and keeps the copied files', async () => {
		const { code, cwd, recorded } = await execute(['site'], {
			userAgent: BUN_AGENT,
			installExitCode: 1
		})
		expect(code).toBe(1)
		expect(recorded.err.join('\n')).toContain('bun install')
		expect(recorded.err.join('\n')).toContain('site')
		expect(existsSync(join(cwd, 'site', 'package.json'))).toBe(true)
		expect(existsSync(join(cwd, 'site', '.env'))).toBe(true)
	})
})

describe('next steps', () => {
	it('lists the .env, the dev command, localePaths and the TODO markers', async () => {
		const { recorded } = await execute(['site'], { userAgent: BUN_AGENT })
		const text = recorded.out.join('\n')
		expect(text).toContain('cd site')
		expect(text).toContain('.env')
		expect(text).toContain('bun run dev')
		expect(text).toContain('localePaths')
		expect(text).toContain('TODO')
		expect(text).not.toContain('bun install')
	})

	it('adds the install step when --no-install is used', async () => {
		const { recorded } = await execute(['site', '--no-install'])
		expect(recorded.out.join('\n')).toContain('npm install')
		expect(recorded.out.join('\n')).toContain('npm run dev')
	})
})
