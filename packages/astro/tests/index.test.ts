import { describe, expect, it } from 'vitest'
import { packageName } from '../src/index'

describe('astro package', () => {
	it('exports its name', () => {
		expect(packageName).toBe('@rushcms/astro')
	})
})
