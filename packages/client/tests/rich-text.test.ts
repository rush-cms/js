import { describe, expect, it } from 'vitest'
import { isRichText } from '../src/index'
import { entryExample } from './fixtures/contract'

type GuardCase = {
	name: string
	value: unknown
}

const DOCUMENT = entryExample().data['body']

const accepted: GuardCase[] = [
	{ name: 'the contract example', value: DOCUMENT },
	{ name: 'an empty document', value: { type: 'doc' } },
	{ name: 'a document with no nodes', value: { type: 'doc', content: [] } }
]

const rejected: GuardCase[] = [
	{ name: 'null', value: null },
	{ name: 'a string', value: 'doc' },
	{ name: 'an array', value: [DOCUMENT] },
	{ name: 'a node that is not a document', value: { type: 'paragraph', content: [] } },
	{ name: 'a block field value', value: { type: 'block', values: {} } },
	{ name: 'a non-string type', value: { type: 1 } },
	{ name: 'content that is not an array', value: { type: 'doc', content: 'text' } },
	{ name: 'a node that is not an object', value: { type: 'doc', content: ['text'] } },
	{ name: 'a node without a type', value: { type: 'doc', content: [{ text: 'x' }] } },
	{ name: 'a key outside the contract', value: { type: 'doc', content: [], html: '<p>' } }
]

describe('isRichText', () => {
	it.each(accepted)('accepts $name', ({ value }) => {
		expect(isRichText(value)).toBe(true)
	})

	it.each(rejected)('rejects $name', ({ value }) => {
		expect(isRichText(value)).toBe(false)
	})

	it('tells the rich-text fields of an entry from its other fields', () => {
		const fields = Object.entries(entryExample().data)
		expect(fields.filter(([, value]) => isRichText(value)).map(([name]) => name)).toEqual([
			'body'
		])
	})
})
