import type { Emitter, Handler } from 'mitt'
import type { ValueOf } from 'type-fest'
import type { ReachValue } from './reach'
import type { Scroller, ScrollerPlugin } from './scroller'
import { Axis } from '@bouzu/shared'
import mitt from 'mitt'
import { checkReach, Reach } from './reach'
import { ScrollerEvent } from './scroller'

export const ReachEvent = {
	Top: 'top',
	Bottom: 'bottom',
	Left: 'left',
	Right: 'right',
	ChangeX: 'change-x',
	ChangeY: 'change-y',
} as const

export type ReachEventValue = ValueOf<typeof ReachEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[ReachEvent.Top]: undefined
	[ReachEvent.Bottom]: undefined
	[ReachEvent.Left]: undefined
	[ReachEvent.Right]: undefined
	[ReachEvent.ChangeX]: {
		value: ReachValue | null
	}
	[ReachEvent.ChangeY]: {
		value: ReachValue | null
	}
}

export type ReachEventHandler<E extends ReachEventValue> = Handler<Events[E]>

export type ReachPlugin = ScrollerPlugin & {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']
	getX: () => ReachValue | null
	getY: () => ReachValue | null
}

export function createReachPlugin(): ReachPlugin {
	type Self = ReachPlugin

	const _emitter = mitt<Events>()
	let _scroller: Scroller | null = null
	let _reachX: ReachValue | null = null
	let _reachY: ReachValue | null = null

	const handler = () => {
		if (_scroller == null)
			return

		const visibleRect = _scroller.getVisibleRect()
		const contentSize = _scroller.getContentSize()
		if (visibleRect == null || contentSize == null)
			return

		const reachX = checkReach(Axis.X, visibleRect, contentSize) ?? null
		const reachY = checkReach(Axis.Y, visibleRect, contentSize) ?? null

		if (reachX !== _reachX) {
			_reachX = reachX
			_emitter.emit(ReachEvent.ChangeX, { value: reachX })

			switch (_reachX) {
				case Reach.Top:
					_emitter.emit(ReachEvent.Top)
					break
				case Reach.Bottom:
					_emitter.emit(ReachEvent.Bottom)
					break
			}
		}

		if (reachY !== _reachY) {
			_reachY = reachY
			_emitter.emit(ReachEvent.ChangeY, { value: reachY })

			switch (_reachY) {
				case Reach.Left:
					_emitter.emit(ReachEvent.Left)
					break
				case Reach.Right:
					_emitter.emit(ReachEvent.Right)
					break
			}
		}
	}

	const getX: Self['getX'] = () => {
		return _reachX
	}

	const getY: Self['getY'] = () => {
		return _reachY
	}

	const init: Self['init'] = (scroller) => {
		_scroller = scroller
		_reachX = null
		scroller.on(ScrollerEvent.ChangeVisibleRect, handler)
		scroller.on(ScrollerEvent.ChangeContentSize, handler)
	}

	const destroy: Self['destroy'] = (scroller) => {
		_emitter.all.clear()
		_scroller = null
		_reachX = null
		scroller.off(ScrollerEvent.ChangeVisibleRect, handler)
		scroller.off(ScrollerEvent.ChangeContentSize, handler)
	}

	return {
		name: 'reach',
		on: _emitter.on,
		off: _emitter.off,
		getX,
		getY,
		init,
		destroy,
	}
}
