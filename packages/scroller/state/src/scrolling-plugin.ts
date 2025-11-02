import type { Emitter, Handler } from 'mitt'
import type { ValueOf } from 'type-fest'
import type { ScrollerEventHandler, ScrollerPlugin } from './scroller'
import mitt from 'mitt'
import { ScrollerEvent } from './scroller'

export const ScrollingEvent = {
	Change: 'change',
} as const

export type ScrollingEventValue = ValueOf<typeof ScrollingEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[ScrollingEvent.Change]: {
		value: boolean
	}
}

export type ScrollingEventHandler<E extends ScrollingEventValue> = Handler<Events[E]>

export type ScrollingPlugin = ScrollerPlugin & {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']
	get: () => boolean
}

const defaultGetTime = () => Date.now()

function defaultRegisterTimeout(handler: () => any, timeout?: number) {
	const id = setTimeout(handler, timeout)
	return () => clearTimeout(id)
}

export function createScrollingPlugin(getTime: (() => number) = defaultGetTime,	registerTimeout: ((handler: () => any, timeout?: number) => () => void) = defaultRegisterTimeout): ScrollingPlugin {
	type Self = ScrollingPlugin

	const _emitter = mitt<Events>()
	let _isScrolling = false
	let _scrollEndTime = 0
	let _scrollTimeout: (() => void) | undefined

	const handleVisibleChange: ScrollerEventHandler<typeof ScrollerEvent.ChangeVisibleRect> = ({
		oldValue,
	}) => {
		if (oldValue == null)
			return

		const now = getTime()

		if (!_isScrolling) {
			_isScrolling = true
			_emitter.emit(ScrollingEvent.Change, { value: _isScrolling })
		}

		if (_scrollEndTime <= now + 50) {
			_scrollEndTime = now + 300

			_scrollTimeout?.()

			_scrollTimeout = registerTimeout(() => {
				_isScrolling = false
				_scrollTimeout = undefined
				_emitter.emit(ScrollingEvent.Change, { value: _isScrolling })
			}, 300)
		}
	}

	const get: Self['get'] = () => {
		return _isScrolling
	}

	const init: Self['init'] = (scroller) => {
		scroller.on(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	const destroy: Self['destroy'] = (scroller) => {
		_emitter.all.clear()
		scroller.off(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	return {
		name: 'scrolling',
		on: _emitter.on,
		off: _emitter.off,
		get,
		init,
		destroy,
	}
}
