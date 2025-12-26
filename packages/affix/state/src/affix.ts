import type { Point, Rect, Size } from '@bouzu/shared'
import type { Emitter } from 'mitt'
import { Axis, createPoint, createRect, createSize, getPointByAxis, getRectMaxByAxis, getSizeByAxis } from '@bouzu/shared'
import mitt from 'mitt'

export const AffixEvent = {
	ChangeFixed: 'change-fixed',
} as const

export const AffixPosition = {
	Start: 'start',
	End: 'end',
} as const

export type AffixPositionValues = typeof AffixPosition[keyof typeof AffixPosition]

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[AffixEvent.ChangeFixed]: {
		value: boolean
	}
}

export interface CreateAffixProps {
	position?: AffixPositionValues
}

export interface Affix {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']

	getVisibleRect: () => Rect | undefined
	setVisibleRect: (value: Rect) => void

	getContentRect: () => Rect
	setContentRect: (value: Rect) => void

	getContainerRect: () => Rect | undefined
	setContainerRect: (value: Rect | undefined) => void

	setPosition: (value: AffixPositionValues) => void

	destroy: () => void
}

export function createAffix(
	props?: CreateAffixProps,
): Affix {
	const _emitter = mitt<Events>()
	let _position: AffixPositionValues = props?.position ?? AffixPosition.Start
	let _visibleRect = createRect()
	let _contentRect = createRect()
	let _containerRect: Rect | undefined
	let _transform: Point | undefined
	let _axis = Axis.Y
	let _fixed = false

	return {
		on: _emitter.on,
		off: _emitter.off,
		getVisibleRect,
		setVisibleRect,
		getContentRect,
		setContentRect,
		getContainerRect,
		setContainerRect,
		setPosition,
		destroy,
	}

	function getVisibleRect() {
		return _visibleRect
	}

	function setVisibleRect(
		value: Rect,
	) {
		_visibleRect = value
		update()
	}

	function getContentRect() {
		return _contentRect
	}

	function setContentRect(
		value: Rect,
	) {
		_contentRect = value
		update()
	}

	function getContainerRect() {
		return _containerRect
	}

	function setContainerRect(
		value: Rect | undefined,
	) {
		_containerRect = value
		_transform = undefined
		update()
	}

	function setPosition(
		value: AffixPositionValues,
	) {
		_position = value
		update()
	}

	function destroy() {
		_emitter.all.clear()
	}

	function update() {
		switch (_position) {
			case AffixPosition.Start: {
				// TODO:
				break
			}
			case AffixPosition.End: {
				// TODO:
				break
			}
		}
	}
}
