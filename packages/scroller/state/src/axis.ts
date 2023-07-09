import type { Point, Rect, Size } from '@bouzu/shared'
import { checkRectIntersectsX, checkRectIntersectsY, getRectMaxX, getRectMaxY } from '@bouzu/shared'

export enum Axis {
	X = 'x',
	Y = 'y',
}

export function checkAxis(currVisibleRect: Rect,
	prevVisibleRect: Rect): Axis | undefined {
	if (Math.abs(currVisibleRect.x - prevVisibleRect.x) > 0)
		return Axis.X
	if (Math.abs(currVisibleRect.y - prevVisibleRect.y) > 0)
		return Axis.Y
}

export function reverseAxis(axis: Axis): Axis {
	switch (axis) {
		case Axis.X:
			return Axis.Y
		case Axis.Y:
			return Axis.X
	}
}

export function getSizeByAxis(size: Size, axis: Axis, reverse = false): number {
	switch (reverse ? reverseAxis(axis) : axis) {
		case Axis.X:
			return size.width
		case Axis.Y:
			return size.height
	}
}

export function getPointByAxis(point: Point, axis: Axis, reverse = false): number {
	return point[reverse ? reverseAxis(axis) : axis]
}

export function updateSizeByAxis(size: Size, axis: Axis, value: number, reverse = false): void {
	switch (reverse ? reverseAxis(axis) : axis) {
		case Axis.X:
			size.width = value
			break
		case Axis.Y:
			size.height = value
			break
	}
}

export function updatePointByAxis(point: Point, axis: Axis, value: number, reverse = false): void {
	point[reverse ? reverseAxis(axis) : axis] = value
}

export function getRectMaxByAxis(rect: Rect, axis: Axis, reverse = false): number {
	switch (reverse ? reverseAxis(axis) : axis) {
		case Axis.X:
			return getRectMaxX(rect)
		case Axis.Y:
			return getRectMaxY(rect)
	}
}

export function checkRectIntersectsByAxis(a: Rect, b: Rect, axis: Axis, reverse = false): boolean {
	switch (reverse ? reverseAxis(axis) : axis) {
		case Axis.X:
			return checkRectIntersectsX(a, b)
		case Axis.Y:
			return checkRectIntersectsY(a, b)
	}
}
