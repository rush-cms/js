import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { required } from '../../walk-kit/env.ts'
import { REPOSITORY_ROOT, packInto, workspacePackage } from '../../walk-kit/pack.ts'
import { startProcess } from '../walk/processes.ts'
import { filesUnder } from '../walk/project.ts'
import { LOCKFILES, PROJECTS, REGISTRY_PORT } from '../walk/projects.ts'
import type { ProjectSpec } from '../walk/projects.ts'
import { startRegistry } from './registry.ts'

const fixture = resolve(import.meta.dirname, '..')
const SDK = ['client', 'astro']

function assertInstalledFromBuild(project: string): string {
	return SDK.map((name) => {
		const built = join(REPOSITORY_ROOT, 'packages', name, 'dist')
		const installed = join(project, 'node_modules', '@rushcms', name, 'dist')
		const files = filesUnder(built).map((file) => relative(built, file))
		for (const file of files) {
			assert.ok(
				readFileSync(join(installed, file)).equals(readFileSync(join(built, file))),
				`${installed}/${file} differs from the build`
			)
		}
		return `@rushcms/${name} (${files.length} dist files equal to the build)`
	}).join(', ')
}

function creatorEnv(registry: string, workDir: string): Record<string, string> {
	return {
		npm_config_registry: registry,
		BUN_CONFIG_REGISTRY: registry,
		npm_config_cache: join(workDir, 'npm-cache'),
		BUN_INSTALL_CACHE_DIR: join(workDir, 'bun-cache'),
		npm_config_audit: 'false',
		npm_config_fund: 'false',
		npm_config_update_notifier: 'false'
	}
}

function creatorCommand(spec: ProjectSpec, createTarball: string): string[] {
	return spec.manager === 'npm'
		? ['npm', 'exec', '--yes', `--package=${createTarball}`, '--', 'create-rush-cms', spec.dir]
		: ['bun', 'x', '--package', createTarball, 'create-rush-cms', spec.dir]
}

async function generate(
	spec: ProjectSpec,
	createTarball: string,
	registry: string,
	workDir: string
): Promise<void> {
	const target = join(workDir, spec.dir)
	assert.ok(!existsSync(target), `${target} already exists`)
	const argv = creatorCommand(spec, createTarball)
	const creator = startProcess({
		cwd: workDir,
		argv,
		env: creatorEnv(registry, workDir),
		unset: ['npm_config_user_agent']
	})
	const code = await creator.finished()
	const output = creator.output()
	console.log(output)
	assert.equal(code, 0, `${argv.join(' ')} exited ${code}`)
	assert.ok(output.includes(`Created ${spec.dir} in ${spec.dir}`), 'create announces the project')
	assert.ok(output.includes(`${spec.manager} run dev`), `next steps name ${spec.manager} run dev`)
	assert.ok(!output.includes('Install manually'), 'the install succeeded')
	for (const lockfile of Object.values(LOCKFILES)) {
		assert.equal(
			existsSync(join(target, lockfile)),
			lockfile === LOCKFILES[spec.manager],
			lockfile
		)
	}
	for (const file of ['.env', '.gitignore', 'astro.config.ts']) {
		assert.ok(existsSync(join(target, file)), `${file} was created`)
	}
	const manifest: unknown = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'))
	assert.equal(Reflect.get(Object(manifest), 'name'), spec.dir)
	console.log(
		`PASS create-rush-cms through ${spec.manager}: ${spec.dir} installed with ${spec.manager} install (${LOCKFILES[spec.manager]}), ${assertInstalledFromBuild(target)}`
	)
}

const workDir = required('E2E_WORK_DIR')
mkdirSync(workDir, { recursive: true })
execFileSync('bun', ['run', 'build'], { cwd: REPOSITORY_ROOT, stdio: 'inherit' })
execFileSync('bun', ['install', '--force'], {
	cwd: resolve(fixture, '../walk-kit'),
	stdio: 'inherit'
})
const [client = '', astro = '', create = ''] = packInto(resolve(fixture, '.packs'), [
	workspacePackage('client', 'rushcms-client.tgz'),
	workspacePackage('astro', 'rushcms-astro.tgz'),
	workspacePackage('create-rush-cms', 'create-rush-cms.tgz')
])
const registry = await startRegistry(REGISTRY_PORT, [client, astro])
try {
	for (const spec of PROJECTS) {
		await generate(spec, create, registry.url, workDir)
	}
} finally {
	await registry.close()
}
