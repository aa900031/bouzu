import type { Size } from '@bouzu/shared'
import type { View, Virtualizer } from '@bouzu/virtualizer'
import { createSize, noop } from '@bouzu/shared'

export interface VirtualizerItem<T extends object> {
	mount: (el: HTMLElement) => void
	unmount: () => void
	destroy: () => void
	updateView: (view: View<T>) => void
}

export function createVirtualizerItem<T extends object>(
	virtualizer: Virtualizer<T>,
): VirtualizerItem<T> {
	type Self = VirtualizerItem<T>

	let _el: HTMLElement | undefined
	let _view: View<T> | undefined
	let _observer: ResizeObserver | undefined

	let _cleanResizeObserver = noop
	let _unbindResizeObserver = noop

	const _handleResizeObserver: ResizeObserverCallback = () => {
		// eslint-disable-next-line ts/no-use-before-define
		_updateSize()
	}

	const _bindResizeObserver = () => {
		if (!('ResizeObserver' in window))
			return

		if (!_el)
			return

		_unbindResizeObserver()
		_cleanResizeObserver()

		_observer = new ResizeObserver(_handleResizeObserver)
		_observer.observe(_el)

		_cleanResizeObserver = () => {
			if (_observer) {
				_observer.disconnect()
				_observer = undefined
			}
		}

		_unbindResizeObserver = () => {
			if (_observer && _el)
				_observer.unobserve(_el)
		}
	}

	const _updateSize = () => {
		if (!_el || !_view)
			return

		virtualizer.updateItemSize(_view.data, getSize(_el))
	}

	const mount: Self['mount'] = (el) => {
		_el = el

		_bindResizeObserver()
		_updateSize()
	}

	const unmount: Self['unmount'] = () => {
		_unbindResizeObserver()
		_el = undefined
	}

	const destroy: Self['destroy'] = () => {
		unmount()
		_cleanResizeObserver()
		_view = undefined
	}

	const updateView: Self['updateView'] = (value) => {
		_view = value

		_updateSize()
	}

	return {
		mount,
		unmount,
		destroy,
		updateView,
	}
}

function getSize(el: HTMLElement): Size {
	return createSize(el.offsetWidth, el.offsetHeight)
}
