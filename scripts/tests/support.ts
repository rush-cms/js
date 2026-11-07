import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export { makeTempDir, removeTempDirs } from '../../packages/create-rush-cms/tests/support'

export function writeFiles(root: string, files: Record<string, string>): void {
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true })
		writeFileSync(join(root, path), content)
	}
}
