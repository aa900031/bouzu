import type { AxisValue, Rect } from '@bouzu/shared'
import type { ValueOf } from 'type-fest'
import { Axis, getPointByAxis } from '@bouzu/shared'

export const Direction = {
	Up: 'up',
	Down: 'down',
	Left: 'left',
	Right: 'right',
} as const

export type DirectionValue = ValueOf<typeof Direction>

export const DirectionType = {
	Nature: 'nature',
	Normal: 'normal',
} as const

export type DirectionTypeValue = ValueOf<typeof DirectionType>

function format(type: DirectionTypeValue, value: DirectionValue): DirectionValue {
	switch (type) {
		case DirectionType.Nature:
			switch (value) {
				case Direction.Up:
					return Direction.Down
				case Direction.Down:
					return Direction.Up
				case Direction.Left:
					return Direction.Right
				case Direction.Right:
					return Direction.Left
				default:
					throw new Error(`Not match value: ${value}`)
			}
		case DirectionType.Normal:
			return value
		default:
			throw new Error(`Not match type: ${type}`)
	}
}

export function checkDirection(
	type: DirectionTypeValue,
	axis: AxisValue | null,
	currVisibleRect: Rect,
	prevVisibleRect: Rect,
): DirectionValue | undefined {
	if (!axis)
		return

	const currDistance = getPointByAxis(currVisibleRect, axis)
	const prevDistance = getPointByAxis(prevVisibleRect, axis)
	const diffDistance = currDistance - prevDistance

	if (diffDistance < 0) {
		switch (axis) {
			case Axis.X:
				return format(type, Direction.Left)
			case Axis.Y:
				return format(type, Direction.Up)
		}
	}
	else if (diffDistance > 0) {
		switch (axis) {
			case Axis.X:
				return format(type, Direction.Right)
			case Axis.Y:
				return format(type, Direction.Down)
		}
	}
}
