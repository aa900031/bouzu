import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { Rect } from '@bouzu/shared'
import { checkRectEqual } from '@bouzu/shared'
import type { ValueOf } from 'type-fest'
import { getOffsetRect } from './offset-rect'

export const OffsetObserveEvent = {
	Change: 'change',
} as const

export type OffsetObserveEventValue = ValueOf<typeof OffsetObserveEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[OffsetObserveEvent.Change]: {
		value: Rect
	}
}

export type OffsetObserveEventHandler<E extends OffsetObserveEventValue> = Handler<Events[E]>

export interface OffsetObserve {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']
	mount: (el: HTMLElement, rootEl?: HTMLElement) => void
	unmount: () => void
	destroy: () => void
	getRect: () => Rect | null
	getTargetElement: () => HTMLElement | undefined
}

export function createOffsetObserve(): OffsetObserve {
	type Self = OffsetObserve

	const _emitter = mitt<Events>()

	let _el: HTMLElement | undefined
	let _rootEl: HTMLElement | undefined
	let _rect: Rect | null = null

	const _trigger = () => {
		if (_el == null)
			return

		const next = getOffsetRect(_el, _rootEl)
		if (_rect != null && checkRectEqual(_rect, next))
			return

		_rect = next
		_emitter.emit(OffsetObserveEvent.Change, { value: _rect })
	}

	const _ro = new ResizeObserver(() => {
		_trigger()
	})

	const get: Self['getRect'] = () => {
		return _rect
	}

	const mount: Self['mount'] = (el, rootEl) => {
		_el = el
		_rootEl = rootEl
		_ro.observe(_el)
		_trigger()
	}

	const unmount: Self['unmount'] = () => {
		_el && _ro.unobserve(_el)
		_rootEl = undefined
		_el = undefined
	}

	const destroy: Self['destroy'] = () => {
		_rect = null
		_emitter.all.clear()
		unmount()
	}

	return {
		on: _emitter.on,
		off: _emitter.off,
		mount,
		unmount,
		destroy,
		getRect: get,
		getTargetElement: () => _el,
	}
}
