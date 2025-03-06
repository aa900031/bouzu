import type { Rect, Size } from '@bouzu/shared'

export function checkOverflow(
	visibleRect: Rect | undefined,
	contentSize: Size | undefined,
): { x: boolean | undefined, y: boolean | undefined } {
	if (!contentSize || !visibleRect) {
		return {
			x: undefined,
			y: undefined,
		}
	}

	return {
		x: contentSize.width > visibleRect.width,
		y: contentSize.height > visibleRect.height,
	}
}
