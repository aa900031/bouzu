import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { ValueOf } from 'type-fest'
import type { AxisPlugin } from './axis-plugin'
import type { ReachValue } from './reach'
import { Reach, checkReach } from './reach'
import type { Scroller, ScrollerEventHandler, ScrollerPlugin } from './scroller'
import { ScrollerEvent } from './scroller'

export const ReachEvent = {
	Top: 'top',
	Bottom: 'bottom',
	Left: 'left',
	Right: 'right',
	Change: 'change',
} as const

export type ReachEventValue = ValueOf<typeof ReachEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[ReachEvent.Top]: undefined
	[ReachEvent.Bottom]: undefined
	[ReachEvent.Left]: undefined
	[ReachEvent.Right]: undefined
	[ReachEvent.Change]: {
		value: ReachValue | null
	}
}

export type ReachEventHandler<E extends ReachEventValue> = Handler<Events[E]>

export type ReachPlugin = ScrollerPlugin & {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']
	get: () => ReachValue | null
}

export function createReachPlugin(): ReachPlugin {
	type Self = ReachPlugin

	const _emitter = mitt<Events>()
	let _scroller: Scroller | null = null
	let _reach: ReachValue | null = null
	let _axis: AxisPlugin | null = null

	const handleVisibleChange: ScrollerEventHandler<typeof ScrollerEvent.ChangeVisibleRect> = ({
		value,
		oldValue,
	}) => {
		if (_axis == null || _scroller == null || oldValue == null)
			return

		const reach = checkReach(_axis.get(), value, oldValue, _scroller.getContentSize()) ?? null

		_reach = reach
		_emitter.emit(ReachEvent.Change, { value: reach })

		switch (_reach) {
			case Reach.Top:
				_emitter.emit(ReachEvent.Top)
				break
			case Reach.Bottom:
				_emitter.emit(ReachEvent.Bottom)
				break
			case Reach.Left:
				_emitter.emit(ReachEvent.Left)
				break
			case Reach.Right:
				_emitter.emit(ReachEvent.Right)
				break
		}
	}

	const get: Self['get'] = () => {
		return _reach
	}

	const init: Self['init'] = (scroller) => {
		const axisPlugin = scroller.getPlugin<AxisPlugin>('axis')
		if (!axisPlugin)
			throw new Error('Plugin "axis" not exist')

		_axis = axisPlugin
		_scroller = scroller
		scroller.on(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	const destroy: Self['destroy'] = (scroller) => {
		_emitter.all.clear()
		_axis = null
		_scroller = null
		scroller.off(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	return {
		name: 'reach',
		on: _emitter.on,
		off: _emitter.off,
		get,
		init,
		destroy,
	}
}
