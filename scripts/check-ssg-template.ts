import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { KEEP_NAMES, copyTree } from '../packages/create-rush-cms/src/copy'
import { SSG_VARIANT } from '../packages/create-rush-cms/src/ssg'
import { applyVariant } from '../packages/create-rush-cms/src/variant'
import { isExcludedFromBundle } from './bundle-template'

const VARIANT_DIR = '.ssg-check'
const ASTRO_BIN = join('node_modules', '.bin', 'astro')
const UNREACHABLE_ENV = {
	RUSH_API_URL: 'http://127.0.0.1:9',
	RUSH_SITE_ID: 'template',
	RUSH_API_TOKEN: 'template'
}

export function generateVariant(template: string, target: string): void {
	copyTree(template, target, {
		skip: (name) => name === VARIANT_DIR || isExcludedFromBundle(name),
		rename: KEEP_NAMES
	})
	applyVariant(target, SSG_VARIANT)
}

function checkVariant(template: string, target: string): number {
	return (
		spawnSync(join(template, ASTRO_BIN), ['check', '--root', target], {
			cwd: template,
			stdio: 'inherit',
			env: { ...process.env, ...UNREACHABLE_ENV }
		}).status ?? 1
	)
}

if (import.meta.main) {
	const template = resolve(import.meta.dirname, '..', 'templates', 'astro')
	const target = join(template, VARIANT_DIR)
	rmSync(target, { recursive: true, force: true })
	try {
		generateVariant(template, target)
		process.exitCode = checkVariant(template, target)
	} finally {
		rmSync(target, { recursive: true, force: true })
	}
}
