export type KeyOf<T> = (item: T) => string

export function firstByKey<T>(items: Iterable<T>, keyOf: KeyOf<T>): T[] {
	const found = new Map<string, T>()
	for (const item of items) {
		const key = keyOf(item)
		if (!found.has(key)) {
			found.set(key, item)
		}
	}
	return [...found.values()]
}
