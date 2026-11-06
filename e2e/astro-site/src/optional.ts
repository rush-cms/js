import { isRushError } from '@rushcms/client'

export async function unlessNotFound<T>(request: Promise<T>): Promise<T | undefined> {
	try {
		return await request
	} catch (err) {
		if (isRushError(err, 'not_found')) {
			return undefined
		}
		throw err
	}
}
