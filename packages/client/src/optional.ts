import { isRushError } from './errors'

export async function optional<T>(request: Promise<T>): Promise<T | undefined> {
	try {
		return await request
	} catch (error) {
		if (isRushError(error, 'not_found')) {
			return undefined
		}
		throw error
	}
}
