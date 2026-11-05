import { defineConfig } from 'tsup'

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		middleware: 'src/middleware.ts',
		'routes/forms': 'src/routes/forms.ts',
		'routes/preview': 'src/routes/preview.ts',
		'routes/preview-exit': 'src/routes/preview-exit.ts'
	},
	format: ['esm'],
	dts: { entry: { index: 'src/index.ts' } },
	clean: true,
	target: 'es2023',
	external: [/^astro:/, /^virtual:/]
})
