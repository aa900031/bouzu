import type { AxisValue, Rect, Size } from '@bouzu/shared'
import type { ValueOf } from 'type-fest'
import { Axis, getPointByAxis, getSizeByAxis } from '@bouzu/shared'

export const Reach = {
	Top: 'top',
	Bottom: 'bottom',
	Left: 'left',
	Right: 'right',
} as const

export type ReachValue = ValueOf<typeof Reach>

export function checkReach(
	axis: AxisValue,
	visibleRect: Rect,
	contentSize: Size,
): ReachValue | undefined {
	const distance = getPointByAxis(visibleRect, axis)
	const visibleValue = getSizeByAxis(visibleRect, axis)
	const contentValue = getSizeByAxis(contentSize, axis)

	if (distance < 1) {
		switch (axis) {
			case Axis.X:
				return Reach.Left
			case Axis.Y:
				return Reach.Top
		}
	}
	else if (distance > contentValue - visibleValue - 1) {
		switch (axis) {
			case Axis.X:
				return Reach.Right
			case Axis.Y:
				return Reach.Bottom
		}
	}
}
