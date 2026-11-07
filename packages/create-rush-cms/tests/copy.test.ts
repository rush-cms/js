import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyTemplate } from '../src/copy'
import { FIXTURE_TEMPLATE, makeTempDir, removeTempDirs } from './support'

afterEach(removeTempDirs)

describe('copyTemplate', () => {
	it('copies nested files and dotfiles', () => {
		const target = join(makeTempDir(), 'site')
		copyTemplate(FIXTURE_TEMPLATE, target)
		expect(readFileSync(join(target, 'src', 'page.txt'), 'utf8')).toBe('TODO fill me\n')
		expect(readFileSync(join(target, '.env.example'), 'utf8')).toContain('RUSH_API_URL=')
		expect(existsSync(join(target, 'package.json'))).toBe(true)
	})

	it('renames _gitignore to .gitignore', () => {
		const target = join(makeTempDir(), 'site')
		copyTemplate(FIXTURE_TEMPLATE, target)
		expect(existsSync(join(target, '_gitignore'))).toBe(false)
		expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('node_modules')
	})

	it('copies into an existing empty directory', () => {
		const target = makeTempDir()
		copyTemplate(FIXTURE_TEMPLATE, target)
		expect(existsSync(join(target, '.gitignore'))).toBe(true)
	})
})
