import { describe, expect, it } from 'vitest'
import type { paths } from '../src/index'

describe('contract types', () => {
	it('exposes the public API paths', () => {
		const path: keyof paths = '/api/v1/openapi.json'
		expect(path).toBe('/api/v1/openapi.json')
	})
})
