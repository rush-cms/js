import { fetchWithRedirects, imageMetadata, isRemoteAllowed } from 'astro/assets/utils'
import { remoteAllowlist } from './rush-image-model'
import type { ImageSize, RemoteImageConfig } from './rush-image-model'

export type RemoteFetch = typeof fetch

type Reader = ReadableStreamDefaultReader<Uint8Array>

function joined(head: Uint8Array, tail: Uint8Array): Uint8Array {
	const bytes = new Uint8Array(head.length + tail.length)
	bytes.set(head, 0)
	bytes.set(tail, head.length)
	return bytes
}

async function sizeIn(bytes: Uint8Array, url: string): Promise<ImageSize | undefined> {
	try {
		const { width, height } = await imageMetadata(bytes, url)
		return { width, height }
	} catch {
		return undefined
	}
}

async function readSize(reader: Reader, url: string): Promise<ImageSize> {
	let bytes: Uint8Array = new Uint8Array()
	for (;;) {
		const chunk = await reader.read()
		if (chunk.done) {
			throw new Error(`no image dimensions found in ${url}`)
		}
		bytes = joined(bytes, chunk.value)
		const size = await sizeIn(bytes, url)
		if (size !== undefined) {
			return size
		}
	}
}

export async function probeRemoteSize(
	url: string,
	config: RemoteImageConfig,
	signal: AbortSignal,
	fetcher: RemoteFetch = fetch
): Promise<ImageSize> {
	const allowlist = remoteAllowlist(config)
	if (!isRemoteAllowed(url, allowlist)) {
		throw new Error(`${url} is not an allowed remote image`)
	}
	const response = await fetchWithRedirects({
		url,
		imageConfig: allowlist,
		fetchFn: (input, init) => fetcher(input, { ...init, signal })
	})
	if (!response.ok || response.body === null) {
		throw new Error(`${url} answered ${String(response.status)} without a body`)
	}
	const reader = response.body.getReader()
	try {
		return await readSize(reader, url)
	} finally {
		await reader.cancel().catch(() => undefined)
	}
}
