export async function withRestore<T>(
	restore: () => Promise<void>,
	use: () => Promise<T>
): Promise<T> {
	let result: T
	try {
		result = await use()
	} catch (err) {
		try {
			await restore()
		} catch (restoreErr) {
			const reason = restoreErr instanceof Error ? restoreErr.message : String(restoreErr)
			const original = err instanceof Error ? err.message : String(err)
			throw new Error(`${original} (restore also failed: ${reason})`, { cause: err })
		}
		throw err
	}
	await restore()
	return result
}
