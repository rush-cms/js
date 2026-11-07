import { describe, expect, it } from 'vitest'
import { packageNameOf } from '../src/package-name'

type Case = {
	dir: string
	expected: string
}

const NPM_VALID = /^[a-z0-9~-][a-z0-9-._~]*$/
const MAX_LENGTH = 214
const SAMPLES = 5000
const SEED = 0x9e3779b9
const ALPHABET = [
	...'abcXYZ019 -_.~/\\@!#$%^&*()+=[]{}:;"\'<>?,|'.split(''),
	'ã',
	'é',
	'中',
	'\u{1f600}',
	'İ',
	'\t',
	'\n'
]

const CASES: Case[] = [
	{ dir: '/tmp/My Site', expected: 'my-site' },
	{ dir: '/tmp/meu-site', expected: 'meu-site' },
	{ dir: '/tmp/.hidden', expected: 'hidden' },
	{ dir: '/tmp/__private', expected: 'private' },
	{ dir: '/tmp/Pão de Açúcar', expected: 'pao-de-acucar' },
	{ dir: '/tmp/site/', expected: 'site' },
	{ dir: '/', expected: 'rush-site' },
	{ dir: '/tmp/___', expected: 'rush-site' },
	{ dir: '/tmp/中文', expected: 'rush-site' },
	{ dir: '/tmp/node_modules', expected: 'rush-site' },
	{ dir: '/tmp/favicon.ico', expected: 'rush-site' }
]

function seededRandom(seed: number): () => number {
	let state = seed
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 2 ** 32
	}
}

function randomName(random: () => number): string {
	const length = Math.floor(random() * 300)
	return Array.from(
		{ length },
		() => ALPHABET[Math.floor(random() * ALPHABET.length)] ?? 'a'
	).join('')
}

describe('packageNameOf', () => {
	it.each(CASES)('$dir -> $expected', ({ dir, expected }) => {
		expect(packageNameOf(dir)).toBe(expected)
	})

	it('truncates to the npm length limit', () => {
		expect(packageNameOf(`/tmp/${'a'.repeat(400)}`)).toHaveLength(MAX_LENGTH)
	})

	it('always returns an npm-valid name for random folder names', () => {
		const random = seededRandom(SEED)
		for (let sample = 0; sample < SAMPLES; sample += 1) {
			const folder = randomName(random).replaceAll('/', '_')
			const name = packageNameOf(`/tmp/${folder}`)
			expect(name, JSON.stringify(folder)).toMatch(NPM_VALID)
			expect(name.length).toBeGreaterThanOrEqual(1)
			expect(name.length).toBeLessThanOrEqual(MAX_LENGTH)
			expect(name).toBe(name.toLowerCase())
		}
	})
})
