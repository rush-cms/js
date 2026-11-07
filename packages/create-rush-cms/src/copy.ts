import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const GITIGNORE_SOURCE = '_gitignore'
const GITIGNORE_TARGET = '.gitignore'

export function copyTemplate(from: string, to: string): void {
	mkdirSync(to, { recursive: true })
	for (const entry of readdirSync(from, { withFileTypes: true })) {
		const source = join(from, entry.name)
		if (entry.isDirectory()) {
			copyTemplate(source, join(to, entry.name))
		} else {
			const name = entry.name === GITIGNORE_SOURCE ? GITIGNORE_TARGET : entry.name
			copyFileSync(source, join(to, name))
		}
	}
}
