import type { Scroller as BaseScroller, ScrollerPlugin } from '@bouzu/scroller'
import { createScroller as createBaseScroller } from '@bouzu/scroller'
import type { Point } from '@bouzu/shared'
import { noop, toPoint, toSize } from '@bouzu/shared'
import type { Simplify } from 'type-fest'
import { toContentVisibleRect, toScrollVisibleRect } from './content-visible'
import type { OffsetObserveEventHandler } from './offset-observe'
import { OffsetObserveEvent, createOffsetObserve } from './offset-observe'
import { onScrollEvent } from './scroll-event'
import { getScrollParent } from './scroll-parent'
import { getVisibleRect } from './visible-rect'

export type Scroller = Simplify<
	& Omit<BaseScroller, 'setVisibleRect' | 'setContentSize'>
	& {
		mount: (el: HTMLElement) => void
		unmount: () => void
		detect: () => void
		scrollTo: (point: Point) => void
		getTargetElement: () => HTMLElement | undefined
		getScrollElement: () => HTMLElement | undefined
		setVisibleByContent: (value: boolean) => void
		setScrollEventPassive: (value: boolean) => void
	}
>

export function createScroller(
	plugins?: ScrollerPlugin[],
): Scroller {
	type Self = Scroller

	const { setVisibleRect, setContentSize, ...base } = createBaseScroller(plugins)
	const _offset = createOffsetObserve()

	let _el: HTMLElement | undefined
	let _scrollEl: HTMLElement | undefined

	let _visibleByContent: boolean | undefined
	let _scrollEventPassive: boolean | undefined

	let _unbindScrollEvent = noop
	let _unbindOffset = noop

	const _trigger = () => {
		if (_scrollEl == null)
			return

		const offsetRect = _offset.get()
		if (offsetRect == null)
			return

		setVisibleRect(toContentVisibleRect(getVisibleRect(_scrollEl), offsetRect))
		setContentSize(toSize(offsetRect))
	}

	const _handleScroll = () => {
		if (_scrollEl == null)
			return

		if (_visibleByContent)
			_trigger()
		else
			setVisibleRect(getVisibleRect(_scrollEl))
	}

	const _handleOffsetChange: OffsetObserveEventHandler<typeof OffsetObserveEvent.Change> = ({ value }) => {
		if (_visibleByContent)
			_trigger()
		else
			setContentSize(toSize(value))
	}

	const _bindScrollEvent = () => {
		if (_scrollEl == null)
			return

		_unbindScrollEvent()
		_unbindScrollEvent = onScrollEvent(
			_scrollEl,
			_handleScroll,
			{ passive: _scrollEventPassive },
		)
		_handleScroll()
	}

	const _bindOffset = () => {
		if (_scrollEl == null)
			return

		_unbindOffset()
		_unbindOffset = () => _offset.unmount()

		_offset.on(OffsetObserveEvent.Change, _handleOffsetChange)

		if (_visibleByContent && _el != null)
			_offset.mount(_el, _scrollEl)
		else
			_offset.mount(_scrollEl)
	}

	const detect: Self['detect'] = () => {
		if (_el == null)
			return

		_scrollEl = getScrollParent(_el, true)
		_bindOffset()
		_bindScrollEvent()
	}

	const mount: Self['mount'] = (el) => {
		_el = el
		detect()
	}

	const unmount: Self['unmount'] = () => {
		_unbindOffset()
		_unbindScrollEvent()

		_el = undefined
		_scrollEl = undefined
	}

	const scrollTo: Self['scrollTo'] = (point) => {
		if (_scrollEl == null)
			return

		if (_visibleByContent) {
			const visibleRect = getVisibleRect(_scrollEl)
			const contentVisibleRect = base.getVisibleRect()
			if (contentVisibleRect == null)
				return

			const contentVisiblePoint = toPoint(toScrollVisibleRect(visibleRect, contentVisibleRect, point))
			_scrollEl.scrollTo(
				contentVisiblePoint.x,
				contentVisiblePoint.y,
			)
		}
		else {
			_scrollEl.scrollTo(
				point.x,
				point.y,
			)
		}
	}

	const setVisibleByContent: Self['setVisibleByContent'] = (value) => {
		_visibleByContent = value
		_bindOffset()
	}

	const setScrollEventPassive: Self['setScrollEventPassive'] = (value) => {
		_scrollEventPassive = value
		_bindScrollEvent()
	}

	return {
		...base,
		mount,
		unmount,
		detect,
		scrollTo,
		setVisibleByContent,
		setScrollEventPassive,
		getTargetElement: () => _el,
		getScrollElement: () => _scrollEl,
	}
}
