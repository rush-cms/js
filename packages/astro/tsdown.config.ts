import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		middleware: 'src/middleware.ts',
		'components-runtime': 'src/components-runtime.ts',
		'form-enhance': 'src/form-enhance.ts',
		'routes/forms': 'src/routes/forms.ts',
		'routes/preview': 'src/routes/preview.ts',
		'routes/preview-exit': 'src/routes/preview-exit.ts'
	},
	format: ['esm'],
	fixedExtension: false,
	dts: true,
	tsconfig: 'tsconfig.build.json',
	clean: true,
	target: 'es2023',
	deps: { neverBundle: [/^astro:/, /^virtual:/] }
})
