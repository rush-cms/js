import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { installedPackage } from '../../../scripts/installed-package'
import * as root from '../src/index'
import * as internal from '../src/internal'

const MANIFEST_PATH = fileURLToPath(new URL('../package.json', import.meta.url))

describe('package exports', () => {
	it('resolves each entrypoint through require.resolve in an installed copy', () => {
		const installed = installedPackage(MANIFEST_PATH)
		try {
			expect(installed.resolve('@rushcms/client')).toBe('dist/index.js')
			expect(installed.resolve('@rushcms/client/internal')).toBe('dist/internal.js')
		} finally {
			installed.remove()
		}
	})

	it('keeps isRecord out of the root and in the internal subpath', () => {
		expect(root).not.toHaveProperty('isRecord')
		expect(root).toHaveProperty('navigationLinks')
		expect(root).toHaveProperty('optional')
		expect(root).toHaveProperty('isRichText')
		expect(Object.keys(internal).sort()).toEqual(['isRecord', 'suggestLocalePaths'])
	})
})
