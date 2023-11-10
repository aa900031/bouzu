import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { ValueOf } from 'type-fest'
import type { AxisPlugin } from './axis-plugin'
import type { DirectionTypeValue, DirectionValue } from './direction'
import { Direction, DirectionType, checkDirection } from './direction'
import type { ScrollerEventHandler, ScrollerPlugin } from './scroller'
import { ScrollerEvent } from './scroller'

export const DirectionEvent = {
	Up: 'up',
	Down: 'down',
	Left: 'left',
	Right: 'right',
	Change: 'change',
} as const

type DirectionEventValue = ValueOf<typeof DirectionEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[DirectionEvent.Up]: undefined
	[DirectionEvent.Down]: undefined
	[DirectionEvent.Left]: undefined
	[DirectionEvent.Right]: undefined
	[DirectionEvent.Change]: {
		value: DirectionValue | null
	}
}

export type DirectionEventHandler<E extends DirectionEventValue> = Handler<Events[E]>

export type DirectionPlugin = ScrollerPlugin & {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']
	get: () => DirectionValue | null
}

export function createDirectionPlugin(
	type: DirectionTypeValue = DirectionType.Normal,
): DirectionPlugin {
	type Self = DirectionPlugin

	const _emitter = mitt<Events>()
	let _direction: DirectionValue | null = null
	let _axis: AxisPlugin | null = null

	const handleVisibleChange: ScrollerEventHandler<typeof ScrollerEvent.ChangeVisibleRect> = ({
		value,
		oldValue,
	}) => {
		if (_axis == null || oldValue == null)
			return

		const direction = checkDirection(type, _axis.get(), value, oldValue) ?? null

		_direction = direction
		_emitter.emit(DirectionEvent.Change, { value: _direction })

		switch (_direction) {
			case Direction.Up:
				_emitter.emit(DirectionEvent.Up)
				break
			case Direction.Down:
				_emitter.emit(DirectionEvent.Down)
				break
			case Direction.Left:
				_emitter.emit(DirectionEvent.Left)
				break
			case Direction.Right:
				_emitter.emit(DirectionEvent.Right)
				break
		}
	}

	const get: Self['get'] = () => {
		return _direction
	}

	const init: Self['init'] = (scroller) => {
		const axisPlugin = scroller.getPlugin<AxisPlugin>('axis')
		if (!axisPlugin)
			throw new Error('Plugin "axis" not exist')

		_axis = axisPlugin
		scroller.on(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	const destroy: Self['destroy'] = (scroller) => {
		_emitter.all.clear()
		_axis = null
		scroller.off(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	return {
		name: 'direction',
		on: _emitter.on,
		off: _emitter.off,
		get,
		init,
		destroy,
	}
}
