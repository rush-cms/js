import { describe, expectTypeOf, it } from 'vitest'
import type {
	BlockValue,
	BlockValues,
	Entry,
	ExpandedDatabaseItem,
	FieldValue,
	FieldValues,
	NestedRepeaterItem,
	RepeaterItem,
	RichText,
	SiteOptionGroup
} from '../src/index'

describe('nested field value types', () => {
	it('types entry data as field values', () => {
		expectTypeOf<Entry['data']>().toEqualTypeOf<FieldValues>()
		expectTypeOf<SiteOptionGroup['values']>().toEqualTypeOf<FieldValues>()
	})

	it('gives every repeater item a string _id', () => {
		expectTypeOf<RepeaterItem['_id']>().toEqualTypeOf<string>()
		expectTypeOf<NestedRepeaterItem['_id']>().toEqualTypeOf<string>()
	})

	it('types a database field value as an array of expanded items', () => {
		expectTypeOf<ExpandedDatabaseItem>().toEqualTypeOf<{
			id: string
			name: string
			description: string
			parent_id: string | null
		}>()
		expectTypeOf<ExpandedDatabaseItem[]>().toExtend<RepeaterItem[string]>()
		expectTypeOf<string[]>().not.toExtend<ExpandedDatabaseItem[]>()
		expectTypeOf<ExpandedDatabaseItem[]>().toExtend<FieldValue>()
		expectTypeOf<RichText>().toExtend<FieldValue>()
	})

	it('types a depth-2 nested repeater item', () => {
		expectTypeOf<NestedRepeaterItem[]>().toExtend<RepeaterItem[string]>()
		expectTypeOf<{ _id: string; label: string }>().toExtend<NestedRepeaterItem>()
		expectTypeOf<{ label: string }>().not.toExtend<NestedRepeaterItem>()
		expectTypeOf<{
			_id: string
			inner: NestedRepeaterItem[]
		}>().not.toExtend<NestedRepeaterItem>()
	})

	it('types block values without block fields', () => {
		expectTypeOf<BlockValue>().not.toExtend<BlockValues[string]>()
	})
})
