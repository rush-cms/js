export async function httpStatus(url: string): Promise<number> {
	const response = await fetch(url, { redirect: 'manual' })
	await response.body?.cancel()
	return response.status
}
