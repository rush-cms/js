import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { installedPackage } from '../../../scripts/installed-package'

const MANIFEST_PATH = fileURLToPath(new URL('../package.json', import.meta.url))

describe('package exports', () => {
	it('resolves the entrypoint through require.resolve in an installed copy', () => {
		const installed = installedPackage(MANIFEST_PATH)
		try {
			expect(installed.resolve('@rushcms/client')).toBe('dist/index.js')
		} finally {
			installed.remove()
		}
	})
})
