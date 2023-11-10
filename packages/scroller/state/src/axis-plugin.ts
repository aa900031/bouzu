import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { Simplify, ValueOf } from 'type-fest'
import type { AxisValue } from './axis'
import { checkAxis } from './axis'
import type { ScrollerEventHandler, ScrollerPlugin } from './scroller'
import { ScrollerEvent } from './scroller'

export const AxisEvent = {
	Change: 'change',
} as const

export type AxisEventValue = ValueOf<typeof AxisEvent>

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Events = {
	[AxisEvent.Change]: {
		value: AxisValue | null
	}
}

export type AxisEventHandler<E extends AxisEventValue> = Handler<Events[E]>

export type AxisPlugin = Simplify<
	& ScrollerPlugin
	& {
		on: Emitter<Events>['on']
		off: Emitter<Events>['off']
		get: () => AxisValue | null
	}
>

export function createAxisPlugin(): AxisPlugin {
	type Self = AxisPlugin

	const _emitter = mitt<Events>()
	let _axis: AxisValue | null = null

	const handleVisibleChange: ScrollerEventHandler<typeof ScrollerEvent.ChangeVisibleRect> = ({
		value,
		oldValue,
	}) => {
		if (oldValue == null)
			return

		const axis = checkAxis(value, oldValue) ?? null
		_axis = axis
		_emitter.emit(AxisEvent.Change, { value: _axis })
	}

	const get: Self['get'] = () => {
		return _axis
	}

	const init: Self['init'] = (scroller) => {
		scroller.on(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	const destroy: Self['destroy'] = (scroller) => {
		_emitter.all.clear()
		scroller.off(ScrollerEvent.ChangeVisibleRect, handleVisibleChange)
	}

	return {
		name: 'axis',
		on: _emitter.on,
		off: _emitter.off,
		get,
		init,
		destroy,
	}
}
