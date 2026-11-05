export type RequestTask<T> = () => Promise<T>

export type RequestReuse = {
	run<T>(key: string, task: RequestTask<T>): Promise<T>
}

export function createRequestReuse(memo: boolean): RequestReuse {
	const inflight = new Map<string, Promise<unknown>>()
	const memoized = new Map<string, unknown>()

	return {
		run<T>(key: string, task: RequestTask<T>): Promise<T> {
			if (memoized.has(key)) {
				return Promise.resolve(memoized.get(key) as T)
			}
			const pending = inflight.get(key)
			if (pending) {
				return pending as Promise<T>
			}
			const started = task()
				.then((value) => {
					if (memo) {
						memoized.set(key, value)
					}
					return value
				})
				.finally(() => {
					inflight.delete(key)
				})
			inflight.set(key, started)
			return started
		}
	}
}
