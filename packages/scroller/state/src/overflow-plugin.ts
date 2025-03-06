import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { ValueOf } from 'type-fest'
import type { Scroller, ScrollerPlugin } from './scroller'
import { ScrollerEvent } from './scroller'
import { checkOverflow } from './overflow'

export const OverflowEvent = {
	ChangeX: 'change-x',
	ChangeY: 'change-y',
} as const

export type OverflowEventValue = ValueOf<typeof OverflowEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[OverflowEvent.ChangeX]: {
		value: boolean | undefined
	}
	[OverflowEvent.ChangeY]: {
		value: boolean | undefined
	}
}

export type OverflowEventHandler<E extends OverflowEventValue> = Handler<Events[E]>

export type OverflowPlugin = ScrollerPlugin & {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']
	getX: () => boolean | undefined
	getY: () => boolean | undefined
}

export function createOverflowPlugin(): OverflowPlugin {
	const _emitter = mitt<Events>()
	let _x: boolean | undefined
	let _y: boolean | undefined
	let _scroller: Scroller | undefined

	function handleChange() {
		const { x, y } = checkOverflow(
			_scroller?.getVisibleRect(),
			_scroller?.getContentSize(),
		)

		if (x !== _x) {
			_x = x
			_emitter.emit(OverflowEvent.ChangeX, { value: _x })
		}

		if (y !== _y) {
			_y = y
			_emitter.emit(OverflowEvent.ChangeY, { value: _y })
		}
	}

	function getX() {
		return _x
	}

	function getY() {
		return _y
	}

	function init(
		scroller: Scroller,
	) {
		_scroller = scroller
		scroller.on(ScrollerEvent.ChangeVisibleRect, handleChange)
		scroller.on(ScrollerEvent.ChangeContentSize, handleChange)
		handleChange()
	}

	function destroy(
		scroller: Scroller,
	) {
		_emitter.all.clear()
		scroller.off(ScrollerEvent.ChangeVisibleRect, handleChange)
		scroller.off(ScrollerEvent.ChangeContentSize, handleChange)
		_scroller = undefined
	}

	return {
		name: 'overflow',
		on: _emitter.on,
		off: _emitter.off,
		getX,
		getY,
		init,
		destroy,
	}
}
