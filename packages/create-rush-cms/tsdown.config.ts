import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/cli.ts'],
	format: ['esm'],
	fixedExtension: false,
	dts: false,
	tsconfig: 'tsconfig.build.json',
	clean: true,
	target: 'node24'
})
