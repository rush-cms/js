import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { packInto, workspacePackage } from '../../walk-kit/pack.ts'

const root = resolve(import.meta.dirname, '..')
const packages = [
	workspacePackage('client', 'rushcms-client.tgz'),
	workspacePackage('astro', 'rushcms-astro.tgz')
]

for (const pkg of packages) {
	execFileSync('bun', ['run', 'build'], { cwd: pkg.dir, stdio: 'inherit' })
}
packInto(resolve(root, '.packs'), packages)
rmSync(resolve(root, 'node_modules/@rushcms'), { recursive: true, force: true })
