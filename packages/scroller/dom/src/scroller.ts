import type { Scroller as BaseScroller, ScrollerPlugin } from '@bouzu/scroller'
import { createScroller as createBaseScroller } from '@bouzu/scroller'
import type { Point } from '@bouzu/shared'
import { noop, toPoint, toSize } from '@bouzu/shared'
import { toContentVisibleRect, toScrollVisibleRect } from './content-visible'
import { OffsetObserveEvent, createOffsetObserve } from './offset-observe'
import { onScrollEvent } from './scroll-event'
import { onResizeEvent } from './resize-event'
import { getScrollParent } from './scroll-parent'
import { getVisibleRect } from './visible-rect'

export interface Scroller {
	state: BaseScroller

	mount: (el: HTMLElement) => void
	unmount: () => void
	destroy: () => void

	detect: () => void
	scrollTo: (point: Point) => void

	getTargetElement: () => HTMLElement | undefined
	getScrollElement: () => HTMLElement | undefined
	setVisibleByContent: (value: boolean) => void
	setScrollEventPassive: (value: boolean) => void
}

export function createScroller(
	plugins?: ScrollerPlugin[],
): Scroller {
	type Self = Scroller

	const scroller = createBaseScroller(plugins)
	const offsetObs = createOffsetObserve()

	let _el: HTMLElement | undefined
	let _scrollEl: HTMLElement | undefined

	let _visibleByContent: boolean | undefined
	let _scrollEventPassive: boolean | undefined

	let _unbindScrollEvent = noop
	let _unbindOffset = noop
	let _unbindResizeEvent = noop

	const _trigger = () => {
		if (_scrollEl == null)
			return

		const offsetRect = offsetObs.getRect()
		if (offsetRect == null)
			return

		const nextVisibleRect = _visibleByContent
			? toContentVisibleRect(getVisibleRect(_scrollEl), offsetRect)
			: getVisibleRect(_scrollEl)

		const nextContentSize = toSize(offsetRect)

		scroller.setVisibleRect(nextVisibleRect)
		scroller.setContentSize(nextContentSize)
	}

	const _handleScroll = () => {
		_trigger()
	}

	const _handleOffsetChange = () => {
		_trigger()
	}

	const _handleResize = () => {
		_trigger()
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
		_unbindOffset = () => offsetObs.unmount()

		offsetObs.on(OffsetObserveEvent.Change, _handleOffsetChange)

		if (_visibleByContent && _el != null)
			offsetObs.mount(_el, _scrollEl)
		else
			offsetObs.mount(_scrollEl)
	}

	const _bindResizeEvent = () => {
		_unbindResizeEvent()
		_unbindResizeEvent = onResizeEvent(_handleResize)
	}

	const detect: Self['detect'] = () => {
		if (_el == null)
			return

		_scrollEl = getScrollParent(_el, true)
		_bindOffset()
		_bindScrollEvent()
		_bindResizeEvent()
	}

	const mount: Self['mount'] = (el) => {
		_el = el
		detect()
	}

	const unmount: Self['unmount'] = () => {
		_unbindOffset()
		_unbindScrollEvent()
		_unbindResizeEvent()

		_el = undefined
		_scrollEl = undefined
	}

	const scrollTo: Self['scrollTo'] = (point) => {
		if (_scrollEl == null)
			return

		if (_visibleByContent) {
			const visibleRect = getVisibleRect(_scrollEl)
			const contentVisibleRect = scroller.getVisibleRect()
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

	const destroy = () => {
		offsetObs.destroy()
		scroller.destroy()
		unmount()
	}

	return {
		state: scroller,
		mount,
		unmount,
		destroy,
		detect,
		scrollTo,
		setVisibleByContent,
		setScrollEventPassive,
		getTargetElement: () => _el,
		getScrollElement: () => _scrollEl,
	}
}
