import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const GITIGNORE_SOURCE = '_gitignore'
const GITIGNORE_TARGET = '.gitignore'

export type CopyRules = {
	skip: (name: string) => boolean
	rename: (name: string) => string
}

export const KEEP_NAMES: CopyRules['rename'] = (name) => name

export const TEMPLATE_RULES: CopyRules = {
	skip: () => false,
	rename: (name) => (name === GITIGNORE_SOURCE ? GITIGNORE_TARGET : name)
}

export function copyTree(from: string, to: string, rules: CopyRules): void {
	mkdirSync(to, { recursive: true })
	for (const entry of readdirSync(from, { withFileTypes: true })) {
		if (rules.skip(entry.name)) {
			continue
		}
		const source = join(from, entry.name)
		const target = join(to, rules.rename(entry.name))
		if (entry.isDirectory()) {
			copyTree(source, target, rules)
		} else {
			copyFileSync(source, target)
		}
	}
}

export function copyTemplate(from: string, to: string): void {
	copyTree(from, to, TEMPLATE_RULES)
}
