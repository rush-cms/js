export type ImageSize = {
	width: number
	height: number
}

export function positive(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function sizeOf(width: unknown, height: unknown): ImageSize | undefined {
	const w = positive(width)
	const h = positive(height)
	return w === undefined || h === undefined ? undefined : { width: w, height: h }
}
