export function nonEmptySubsets<T>(items: T[]): T[][] {
	return Array.from({ length: 2 ** items.length - 1 }, (_, mask) =>
		items.filter((_, index) => ((mask + 1) >> index) & 1)
	)
}
