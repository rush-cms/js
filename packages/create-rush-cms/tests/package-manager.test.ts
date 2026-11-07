import { describe, expect, it } from 'vitest'
import { detectPackageManager } from '../src/package-manager'
import type { PackageManager } from '../src/package-manager'

type Case = {
	userAgent: string | undefined
	expected: PackageManager
}

const CASES: Case[] = [
	{ userAgent: 'npm/11.6.0 node/v24.1.0 linux x64 workspaces/false', expected: 'npm' },
	{ userAgent: 'pnpm/10.4.0 npm/? node/v24.1.0 linux x64', expected: 'pnpm' },
	{ userAgent: 'bun/1.4.4 npm/? node/v24.3.0 linux x64', expected: 'bun' },
	{ userAgent: 'yarn/4.9.0 npm/? node/v24.1.0 linux x64', expected: 'yarn' },
	{ userAgent: undefined, expected: 'npm' },
	{ userAgent: '', expected: 'npm' },
	{ userAgent: 'deno/2.0.0', expected: 'npm' },
	{ userAgent: 'pnpmish/1.0.0', expected: 'npm' }
]

describe('detectPackageManager', () => {
	it.each(CASES)('$userAgent -> $expected', ({ userAgent, expected }) => {
		expect(detectPackageManager(userAgent)).toBe(expected)
	})
})
