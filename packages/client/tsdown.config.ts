import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts', 'src/internal.ts'],
	format: ['esm'],
	fixedExtension: false,
	dts: true,
	tsconfig: 'tsconfig.build.json',
	clean: true,
	target: 'es2023'
})
