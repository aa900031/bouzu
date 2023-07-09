export interface Size {
	width: number
	height: number
}

export function createSize(
	width = 0,
	height = 0,
): Size {
	return { width, height }
}

export function checkSizeEqual(
	a: Size,
	b: Size,
) {
	return a.width === b.width
  && a.height === b.height
}
