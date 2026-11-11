import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { ImageSize } from '../../src/components/rush-image-model'

function imageHost(): string {
	const host = process.env.RUSH_TEST_IMAGE_HOST
	if (host === undefined) {
		throw new Error('vitest.config sets no RUSH_TEST_IMAGE_HOST')
	}
	return host
}

export type ImageServer = {
	url(path: string): string
	hits(path: string): number
	close(): Promise<void>
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngHeader({ width, height }: ImageSize): Buffer {
	const chunk = Buffer.alloc(25)
	chunk.writeUInt32BE(13, 0)
	chunk.write('IHDR', 4, 'ascii')
	chunk.writeUInt32BE(width, 8)
	chunk.writeUInt32BE(height, 12)
	chunk.writeUInt8(8, 16)
	chunk.writeUInt8(2, 17)
	return Buffer.concat([Buffer.from(PNG_SIGNATURE), chunk])
}

export async function startImageServer(images: Record<string, ImageSize>): Promise<ImageServer> {
	const host = imageHost()
	const counts = new Map<string, number>()
	const server = createServer((request, response) => {
		const path = request.url ?? ''
		counts.set(path, (counts.get(path) ?? 0) + 1)
		const size = Object.hasOwn(images, path) ? images[path] : undefined
		if (size === undefined) {
			response.writeHead(404).end()
			return
		}
		response.writeHead(200, { 'Content-Type': 'image/png' }).end(pngHeader(size))
	})
	await new Promise<void>((resolve) => server.listen(0, host, resolve))
	const { port } = server.address() as AddressInfo
	return {
		url: (path) => `http://${host}:${port}${path}`,
		hits: (path) => counts.get(path) ?? 0,
		close: () => new Promise<void>((resolve) => server.close(() => resolve()))
	}
}
