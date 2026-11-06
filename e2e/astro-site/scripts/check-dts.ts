import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const SDK_DECLARATIONS = 'node_modules/@rushcms/'

const root = resolve(import.meta.dirname, '..')
const result = spawnSync(
	resolve(root, 'node_modules/typescript7/bin/tsc'),
	['-p', 'tsconfig.dts.json'],
	{
		cwd: root,
		encoding: 'utf8'
	}
)
const sdkErrors = result.stdout
	.split('\n')
	.filter((line) => line.startsWith(SDK_DECLARATIONS) && line.includes(': error TS'))

if (result.error !== undefined || sdkErrors.length > 0) {
	console.error(result.error?.message ?? sdkErrors.join('\n'))
	process.exit(1)
}
console.log('SDK declaration files type-check without skipLibCheck')
