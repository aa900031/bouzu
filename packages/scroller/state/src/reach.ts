import type { Rect, Size } from '@bouzu/shared'
import { Axis, getPointByAxis, getSizeByAxis } from './axis'

export enum Reach {
	Top = 'top',
	Bottom = 'bottom',
	Left = 'left',
	Right = 'right',
}

export function checkReach(axis: Axis | null,
	currVisibleRect: Rect,
	prevVisibleRect: Rect,
	contentSize: Size): Reach | undefined {
	if (!axis)
		return

	const currDistance = getPointByAxis(currVisibleRect, axis)
	const prevDistance = getPointByAxis(prevVisibleRect, axis)
	const diffDistance = currDistance - prevDistance
	if (!diffDistance)
		return

	const visibleValue = getSizeByAxis(currVisibleRect, axis)
	const contentValue = getSizeByAxis(contentSize, axis)

	if (currDistance < 1) {
		switch (axis) {
			case Axis.X:
				return Reach.Left
			case Axis.Y:
				return Reach.Top
		}
	}
	else if (currDistance > contentValue - visibleValue - 1) {
		switch (axis) {
			case Axis.X:
				return Reach.Right
			case Axis.Y:
				return Reach.Bottom
		}
	}
}
