import type { ValueOf } from 'type-fest'
import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { Point, Rect, Size } from '@bouzu/shared'
import { checkRectEqualPoint, checkRectEqualSize, checkSizeEqual, cloneRect, createPoint, createRect, createSize, getRectArea, getRectCornerInOther, getRectMaxX, getRectMaxY, getRectPointByRectCorner } from '@bouzu/shared'
import type { Animation, EaseFn } from './animation'
import { createAnimation, createNoopAnimation, easeOut } from './animation'
import type { Layout, Layouts, ReloadContext } from './layouts'
import { mergeReloadContext } from './layouts'
import { createOverscan } from './overscan'
import type { ScrollAnchor } from './scroll-anchor'
import type { CancelRaf, RegisterRafMethods } from './utils/raf'
import { registerRaf } from './utils/raf'
import type { GetTimeFn } from './utils/time'
import type { ReuseView, View } from './view'
import { createView, toReuseView, toView } from './view'
import { differenceMap } from './utils/map-helper'

export const VirtualizerEvent = {
	ChangeContentSize: 'changecontentsize',
	ChangeVisibleRect: 'changevisiblerect',
	ChangeVisibleViews: 'changevisibleviews',
	ChangeAnimating: 'changeanimating',
	ChangeScrolling: 'changescrolling',
} as const

export type VirtualizerEventValue = ValueOf<typeof VirtualizerEvent>

// eslint-disable-next-line ts/consistent-type-definitions
type Events<T extends object> = {
	[VirtualizerEvent.ChangeContentSize]: {
		value: Size
	}
	[VirtualizerEvent.ChangeVisibleRect]: {
		value: Rect
	}
	[VirtualizerEvent.ChangeVisibleViews]: {
		value: Iterable<View<T>>
	}
	[VirtualizerEvent.ChangeAnimating]: {
		value: boolean
	}
	[VirtualizerEvent.ChangeScrolling]: {
		value: boolean
	}
}

export type VirtualizerEventHandler<T extends object, E extends VirtualizerEventValue> = Handler<Events<T>[E]>

export interface ScrollToOptions {
	ease?: EaseFn
	duration?: number
}

export type ScrollToItemOptions = ScrollToOptions & {
	shouldScrollX?: boolean
	shouldScrollY?: boolean
	offsetX?: number
	offsetY?: number
}

type AnchorScrollPosition = boolean | 'top'

export interface Virtualizer<T extends object> {
	on: Emitter<Events<T>>['on']
	off: Emitter<Events<T>>['off']

	setData: (value: T[]) => void
	setLayouts: (value: Layouts<T>) => void

	getVisibleRect: () => Rect
	setVisibleRect: (value: Rect, immediate?: boolean) => void

	getIsScrolling: () => boolean
	setIsScrolling: (value: boolean) => void

	getContentSize: () => Size
	getVisibleViews: () => Iterable<View<T>>

	setAnchorScrollPosition: (val: AnchorScrollPosition) => void
	setOverscanThrottle: (val: number) => void

	updateItemSize: (item: T, size: Size) => void

	scrollTo: (offset: Point, options?: ScrollToOptions) => Animation
	scrollToItem: (item: T, options?: ScrollToItemOptions) => Animation | void

	destroy: () => void
	collect: () => void
}

export type VirtualizerOptions = {
	rafFn?: RegisterRafMethods['raf']
	cafFn?: RegisterRafMethods['caf']
	getTimeFn?: GetTimeFn
} & {
	/**
	 * @default 500
	 */
	overscanThrottle?: number
	/**
	 * @default true
	 */
	anchorScrollPosition?: AnchorScrollPosition
}

export function createVirtualizer<T extends object>(
	opts?: VirtualizerOptions,
): Virtualizer<T> {
	type Self = Virtualizer<T>

	const _emitter = mitt<Events<T>>()
	const _overscan = createOverscan({
		throttleTime: opts?.overscanThrottle,
		getTime: opts?.getTimeFn,
	})

	let _visibleRect: Rect = createRect()
	let _contentSize: Size = createSize()

	let _data: T[] | null = null
	let _layouts: Layouts<T> | null = null

	const _visibleLayouts = new Map<string, Layout>()
	const _visibleIndexes = new Map<string, number>()
	const _visibleViews = new Map<string, View<T>>()
	const _reusableViews: ReuseView[] = []

	let _reloadLayoutContext: ReloadContext | null = null
	let _cancelReloadLayout: CancelRaf | null = null

	let _isScrolling = false
	let _scrollAnimation: Animation | null = null
	const _sizeUpdateQueue = new Map<T, Size>()

	let _anchorScrollPosition = opts?.anchorScrollPosition ?? true
	const _registerRafMethods: RegisterRafMethods | undefined = opts?.rafFn && opts?.cafFn
		? {
				raf: opts.rafFn,
				caf: opts.cafFn,
			}
		: undefined

	const _setContentSize = (
		val: Size,
	) => {
		const curr = _contentSize
		if (checkSizeEqual(curr, val))
			return

		_contentSize = val
		_emitter.emit(VirtualizerEvent.ChangeContentSize, { value: val })
	}

	const _getScrollAnchor = (): ScrollAnchor | null => {
		if (!_layouts)
			return null

		if (!_anchorScrollPosition)
			return null

		const visibleRect = _visibleRect

		if (visibleRect.y === 0 && _anchorScrollPosition !== 'top')
			return null

		let cornerAnchor: ScrollAnchor | null = null

		for (const [, layout] of _visibleLayouts) {
			if (layout && getRectArea(layout.rect) > 0) {
				const corner = getRectCornerInOther(layout.rect, visibleRect)
				if (corner) {
					const point = getRectPointByRectCorner(layout.rect, corner)
					const offset = createPoint(point.x - visibleRect.x, point.y - visibleRect.y)
					if (!cornerAnchor || (offset.y < cornerAnchor.offset.y) || (offset.x < cornerAnchor.offset.x))
						cornerAnchor = { layout, corner, offset }
				}
			}
		}

		return cornerAnchor
	}

	const _restoreScrollAnchor = (
		scrollAnchor: ScrollAnchor | null,
	) => {
		const contentOffset = cloneRect(_visibleRect)
		if (!_layouts)
			return contentOffset

		if (scrollAnchor) {
			const layout = scrollAnchor.layout
			if (layout) {
				const point = getRectPointByRectCorner(layout.rect, scrollAnchor.corner)
				contentOffset.x += (point.x - contentOffset.x) - scrollAnchor.offset.x
				contentOffset.y += (point.y - contentOffset.y) - scrollAnchor.offset.y
			}
		}

		return contentOffset
	}

	const _setContentOffset = (
		offset: Point,
	) => {
		const rect = createRect(offset.x, offset.y, _visibleRect.width, _visibleRect.height)
		// eslint-disable-next-line ts/no-use-before-define
		setVisibleRect(rect, true)
		_emitter.emit(VirtualizerEvent.ChangeVisibleRect, { value: rect })
	}

	const _reuseView = (
		view: View<T>,
	): ReuseView => {
		const reuseView = toReuseView(view)
		_reusableViews.push(reuseView)
		return reuseView
	}

	const _createView = (
		index: number,
		data: T,
		layout: Layout,
	): View<T> => {
		const reuseView = _reusableViews.pop()
		if (reuseView)
			return toView(reuseView, index, data, layout)
		else
			return createView(index, data, layout)
	}

	const _updateVisibleViews = () => {
		if (!_data)
			return

		const { toAdd, toRemove, toUpdate } = differenceMap(_visibleViews, _visibleLayouts)
		if (toAdd.size === 0 && toRemove.size === 0 && toUpdate.size === 0)
			return

		for (const key of toRemove.keys()) {
			const view = _visibleViews.get(key)
			if (view) {
				_visibleViews.delete(key)
				_reuseView(view)
			}
		}

		for (const key of toAdd.keys()) {
			const layout = _visibleLayouts.get(key)
			const index = _visibleIndexes.get(key)
			if (index == null || !layout)
				continue

			const view = _createView(index, _data[index], layout)
			_visibleViews.set(key, view)
		}

		_emitter.emit(VirtualizerEvent.ChangeVisibleViews, {
			// eslint-disable-next-line ts/no-use-before-define
			value: getVisibleViews(),
		})
	}

	const _updateViews = (
		_force = false,
	): boolean => {
		if (!_layouts)
			return false

		const rect = _overscan.getRect()

		_visibleLayouts.clear()
		_visibleIndexes.clear()

		for (const { index, layout } of _layouts.getVisibleItems(rect)) {
			_visibleIndexes.set(layout.key, index)
			_visibleLayouts.set(layout.key, layout)
		}

		_updateVisibleViews()

		return true
	}

	const _reloadLayout = (
		context: ReloadContext = _reloadLayoutContext ?? {},
	) => {
		if (_cancelReloadLayout) {
			_cancelReloadLayout()
			context = { ..._reloadLayoutContext, ...context }
		}

		_reloadLayoutContext = null

		if (!_data || !_layouts || _scrollAnimation)
			return

		const scrollAnchor = _getScrollAnchor()

		_layouts.reload(_data, _visibleRect, context)
		_setContentSize(_layouts.getContentSize())

		const restoredScrollAnchor = _restoreScrollAnchor(scrollAnchor)
		const contentOffset = createPoint(
			context.dataChanged ? 0 : restoredScrollAnchor.x,
			context.dataChanged ? 0 : restoredScrollAnchor.y,
		)
		contentOffset.x = Math.max(0, Math.min(_contentSize.width - _visibleRect.width, contentOffset.x))
		contentOffset.y = Math.max(0, Math.min(_contentSize.height - _visibleRect.height, contentOffset.y))
		if (!checkRectEqualPoint(_visibleRect, contentOffset))
			_setContentOffset(contentOffset)
		else
			_updateViews(context.dataChanged)
	}

	const _triggerReloadLayout = (
		context: ReloadContext = {},
	): void => {
		if (_scrollAnimation)
			return

		if (_reloadLayoutContext) {
			_reloadLayoutContext = mergeReloadContext(_reloadLayoutContext, context)
			return
		}

		_reloadLayoutContext = context
		_cancelReloadLayout = registerRaf(() => _reloadLayout(), _registerRafMethods)
	}

	const setData: Self['setData'] = (value) => {
		_visibleLayouts.clear()
		_sizeUpdateQueue.clear()

		_data = value
		_triggerReloadLayout({
			dataChanged: true,
		})
	}

	const setLayouts: Self['setLayouts'] = (value) => {
		const curr = _layouts
		if (value === curr)
			return

		_layouts = value
		_triggerReloadLayout()
	}

	const getVisibleRect: Self['getVisibleRect'] = () => {
		return _visibleRect
	}

	const setVisibleRect: Self['setVisibleRect'] = (value, immediate = false) => {
		const curr = _visibleRect
		const isOffsetChange = !checkRectEqualPoint(value, curr)
		const isSizeChange = !checkRectEqualSize(value, curr)

		if (!isOffsetChange && !isSizeChange) {
			// 都沒改變，不需更新
			return
		}

		_overscan.setVisibleRect(value)
		_visibleRect = value

		if (immediate) {
			_reloadLayout({
				offsetChanged: isOffsetChange,
				sizeChanged: isSizeChange,
			})
		}
		else {
			_triggerReloadLayout({
				offsetChanged: isOffsetChange,
				sizeChanged: isSizeChange,
			})
		}
	}

	const getIsScrolling: Self['getIsScrolling'] = () => {
		return _isScrolling
	}

	const setIsScrolling: Self['setIsScrolling'] = (value: boolean) => {
		// 正在執行 ScrollAnimation
		if (_scrollAnimation) {
			// 不需更新
			return
		}

		// 新值等於現值
		if (_isScrolling === value) {
			// 不需更新
			return
		}

		_isScrolling = value
		_emitter.emit(VirtualizerEvent.ChangeScrolling, { value })
	}

	const getContentSize: Self['getContentSize'] = () => {
		return _contentSize
	}

	const getVisibleViews: Self['getVisibleViews'] = () => {
		return _visibleViews.values()
	}

	const updateItemSize: Self['updateItemSize'] = (item, size) => {
		if (!_layouts)
			return

		// 正在執行 ScrollAnimation
		if (_scrollAnimation) {
			// 把資料放進 queue 裡，等 ScrollAnimation 完成後執行
			_sizeUpdateQueue.set(item, size)
			return
		}

		_sizeUpdateQueue.delete(item)

		// 呼叫 layout 的 updateItemSize
		const changed = _layouts.updateItemSize(item, size)
		if (!changed)
			return

		_triggerReloadLayout()
	}

	const scrollToItem: Self['scrollToItem'] = (item, options = {}) => {
		if (item == null)
			return

		const layout = _layouts?.getItem(item)
		if (!layout)
			return

		const {
			shouldScrollX = true,
			shouldScrollY = true,
			offsetX = 0,
			offsetY = 0,
		} = options

		let x = _visibleRect.x
		let y = _visibleRect.y
		const minX = layout.rect.x - offsetX
		const minY = layout.rect.y - offsetY
		const maxX = x + _visibleRect.width
		const maxY = y + _visibleRect.height

		if (shouldScrollX) {
			if (minX <= x || maxX === 0)
				x = minX
			else if (getRectMaxX(layout.rect) > maxX)
				x += getRectMaxX(layout.rect) - maxX
		}

		if (shouldScrollY) {
			if (minY <= y || maxY === 0)
				y = minY
			else if (getRectMaxY(layout.rect) > maxY)
				y += getRectMaxY(layout.rect) - maxY
		}

		// eslint-disable-next-line ts/no-use-before-define
		return scrollTo(createPoint(x, y), options)
	}

	const scrollTo: Self['scrollTo'] = (offset, options = {}) => {
		// Cancel the current scroll animation
		if (_scrollAnimation) {
			_scrollAnimation.cancel()
			_scrollAnimation = null
		}

		const {
			duration = 300,
			ease = easeOut,
		} = options

		// Set the content offset synchronously if the duration is zero
		if (duration <= 0 || checkRectEqualPoint(_visibleRect, offset)) {
			_setContentOffset(offset)
			return createNoopAnimation()
		}

		setIsScrolling(true)

		const result = createAnimation(
			_visibleRect,
			offset,
			duration,
			ease,
			offset => _setContentOffset(offset),
			opts?.getTimeFn,
		)

		result.then(() => {
			_scrollAnimation = null

			// 執行未完成的更新尺寸工作
			_sizeUpdateQueue.forEach((size, item) => updateItemSize(item, size))

			_triggerReloadLayout()

			setIsScrolling(false)
		})

		return _scrollAnimation = result
	}

	const destroy: Self['destroy'] = () => {
		_cancelReloadLayout?.()
		_scrollAnimation?.cancel()
		_sizeUpdateQueue.clear()
		_emitter.all.clear()
	}

	const collect: Self['collect'] = () => {
		_overscan.collect()
	}

	const setAnchorScrollPosition: Self['setAnchorScrollPosition'] = (val) => {
		_anchorScrollPosition = val
	}

	const setOverscanThrottle: Self['setOverscanThrottle'] = (val) => {
		return _overscan.setThrottleTime(val)
	}

	return {
		on: _emitter.on,
		off: _emitter.off,
		setData,
		setLayouts,
		getVisibleRect,
		setVisibleRect,
		getIsScrolling,
		setIsScrolling,
		getContentSize,
		getVisibleViews,
		setOverscanThrottle,
		setAnchorScrollPosition,
		updateItemSize,
		scrollToItem,
		scrollTo,
		destroy,
		collect,
	}
}
