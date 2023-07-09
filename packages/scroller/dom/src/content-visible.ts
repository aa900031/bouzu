import type { Point, Rect } from '@bouzu/shared'
import { createRect } from '@bouzu/shared'

export function toContentVisibleRect(
	scrollVisibleRect: Rect,
	contentOffsetRect: Rect,
): Rect {
	const maxX = contentOffsetRect.width - scrollVisibleRect.width
	const maxY = contentOffsetRect.height - scrollVisibleRect.height
	const rawX = scrollVisibleRect.x - contentOffsetRect.x
	const rawY = scrollVisibleRect.y - contentOffsetRect.y
	const visibleX = Math.max(0, Math.min(rawX, maxX))
	const visibleY = Math.max(0, Math.min(rawY, maxY))
	const visibleWidth = scrollVisibleRect.width + Math.min(0, rawX) - Math.max(0, rawX - maxX)
	const visibleHeight = scrollVisibleRect.height + Math.min(0, rawY) - Math.max(0, rawY - maxY)

	return createRect(
		visibleX,
		visibleY,
		visibleWidth,
		visibleHeight,
	)
}

export function toScrollVisibleRect(
	scrollVisibleRect: Rect,
	origin: Rect,
	point: Point,
) {
	return createRect(
		scrollVisibleRect.x - (origin.x - point.x),
		scrollVisibleRect.y - (origin.y - point.y),
		scrollVisibleRect.width,
		scrollVisibleRect.height,
	)
}
