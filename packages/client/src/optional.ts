import { isRushError } from './errors'

const NOT_FOUND = 404

export async function optional<T>(request: Promise<T>): Promise<T | undefined> {
	try {
		return await request
	} catch (error) {
		if (isRushError(error) && error.status === NOT_FOUND) {
			return undefined
		}
		throw error
	}
}
