import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

type SdkPackage = {
	dir: string
	filename: string
}

const root = resolve(import.meta.dirname, '..')
const packs = resolve(root, '.packs')
const packages: SdkPackage[] = [
	{ dir: resolve(root, '../../packages/client'), filename: 'rushcms-client.tgz' },
	{ dir: resolve(root, '../../packages/astro'), filename: 'rushcms-astro.tgz' }
]

rmSync(packs, { recursive: true, force: true })
mkdirSync(packs)
for (const pkg of packages) {
	execFileSync('bun', ['run', 'build'], { cwd: pkg.dir, stdio: 'inherit' })
	execFileSync('bun', ['pm', 'pack', '--filename', resolve(packs, pkg.filename), '--quiet'], {
		cwd: pkg.dir,
		stdio: 'inherit'
	})
}
rmSync(resolve(root, 'node_modules/@rushcms'), { recursive: true, force: true })
