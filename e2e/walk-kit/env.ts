export const SITE_PORT = 4321
export const PREVIEW_PORT = 4322
export const PROXY_HOST = 'visitor.test'
export const PROXY_PORT = 4400

export function localUrl(port: number): string {
	return `http://localhost:${port}`
}

export function required(name: string): string {
	const value = process.env[name]
	if (value === undefined || value === '') {
		throw new Error(`${name} is not set (see e2e/README.md)`)
	}
	return value
}
