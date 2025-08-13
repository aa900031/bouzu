import type { AxisValue, Rect, Size } from '@bouzu/shared'
import { Axis, checkRectIntersectsByAxis, checkSizeEqual, createRect, createSize, getPointByAxis, getRectMaxByAxis, getSizeByAxis, updatePointByAxis, updateSizeByAxis } from '@bouzu/shared'
import type { Layout, Layouts } from '../layouts'
import { createLayout } from '../layouts'
import { createAssemble } from '../utils/assemble'

export type ListLayouts<T extends object> =
	& Layouts<T>
	& {
		setAxis: (value: AxisValue) => void
		setItemSize: (value: number) => void
		setEstimatedItemSize: (value: number) => void
	}

export interface CreateListLayoutsOptions {
	axis?: AxisValue
	itemSize?: number
	estimatedItemSize?: number
}

const DEFAULT_ITEM_SIZE = 48

export function createListLayouts<T extends object>(
	opts?: CreateListLayoutsOptions,
): ListLayouts<T> {
	type Self = ListLayouts<T>

	let _data: T[] | null = null
	let _contentSize: Size = createSize()

	let _axis = opts?.axis ?? Axis.Y
	let _itemSize = opts?.itemSize
	let _estimatedItemSize = opts?.estimatedItemSize ?? DEFAULT_ITEM_SIZE

	const _indexes = new WeakMap<T, number>()
	const _layouts = new WeakMap<T, Layout>()
	const _assemble = createAssemble(
		// eslint-disable-next-line ts/no-use-before-define
		index => _getItemSize(index),
		// eslint-disable-next-line ts/no-use-before-define
		index => _getItemPosition(index),
		// eslint-disable-next-line ts/no-use-before-define
		(index, value) => _updateItemPosition(index, value),
	)

	const _getLayout = (index: number): Layout | undefined => {
		if (!_data)
			throw new Error('Failed to get `_data`')
		return _layouts.get(_data[index])
	}

	const _getItemCalcSize = (layout?: Layout) => {
		let value = layout ? getSizeByAxis(layout.rect, _axis) : undefined
		let isEstimated = layout?.estimated ?? true

		if (value == null) {
			value = _itemSize
			isEstimated = false
		}

		if (value == null) {
			value = _estimatedItemSize
			isEstimated = true
		}

		return {
			value,
			isEstimated,
		}
	}

	const _getItemCalcPosition = (index: number) => {
		return _assemble.positionAt(index)
	}

	const _getItemSize = (index: number) => {
		const layout = _getLayout(index)
		if (layout == null)
			return
		return getSizeByAxis(layout.rect, _axis)
	}

	const _getItemPosition = (index: number) => {
		const layout = _getLayout(index)
		if (layout == null)
			return
		return getPointByAxis(layout.rect, _axis)
	}

	const _updateItemPosition = (index: number, value: number) => {
		const layout = _getLayout(index)
		if (layout == null)
			return
		return updatePointByAxis(layout.rect, _axis, value)
	}

	const _updateContentSize = (rect: Rect) => {
		if (!_data)
			throw new Error('Failed to get `_data`')

		const lastIndex = _data.length - 1

		const width = (() => {
			switch (_axis) {
				case Axis.X:
					return (_getItemCalcPosition(lastIndex) ?? 0) + (_getItemSize(lastIndex) ?? 0)
				case Axis.Y:
					return rect.width
			}
		})()
		const height = (() => {
			switch (_axis) {
				case Axis.X:
					return rect.height
				case Axis.Y:
					return (_getItemCalcPosition(lastIndex) ?? 0) + (_getItemSize(lastIndex) ?? 0)
			}
		})()

		_contentSize = createSize(width, height)
	}

	const _fillSize = (rect: Rect) => {
		const min = Math.max(0, getPointByAxis(rect, _axis))
		const max = min + getSizeByAxis(rect, _axis)
		_assemble.consolidate(min, max)
	}

	const _indexAt = (visibleRect: Rect) => {
		if (!_data)
			throw new Error('Failed to get `_data`')

		const position = getPointByAxis(visibleRect, _axis)
		return _assemble.indexAt(position)
	}

	const _checkItemVisible = (index: number, visibleRect: Rect): boolean => {
		const layout = _getLayout(index)
		if (layout == null)
			return false
		return checkRectIntersectsByAxis(layout.rect, visibleRect, _axis)
	}

	const reload: Self['reload'] = (data, visibleRect, context) => {
		if (context.dataChanged === true || _data === null) {
			_assemble.reset(data.length)

			// reIndex
			let position = 0
			let index = 0
			while (index < data.length) {
				const item = data[index]
				const { value, isEstimated } = _getItemCalcSize(_layouts.get(item))
				const layout = _layouts.get(item) ?? createLayout(createRect())

				updatePointByAxis(layout.rect, _axis, position)
				updatePointByAxis(layout.rect, _axis, 0, true)
				updateSizeByAxis(layout.rect, _axis, value)
				updateSizeByAxis(layout.rect, _axis, getSizeByAxis(visibleRect, _axis, true), true)
				layout.estimated = isEstimated

				_indexes.set(item, index)
				_layouts.set(item, layout)

				position = getRectMaxByAxis(layout.rect, _axis)
				index += 1
			}

			// 更新 data
			_data = data
		}

		_fillSize(visibleRect)

		_updateContentSize(visibleRect)
	}

	const getContentSize = () => {
		return _contentSize
	}

	const getItem: Self['getItem'] = (item) => {
		return _layouts.get(item)
	}

	const updateItemSize: Self['updateItemSize'] = (item, size) => {
		const layout = _layouts.get(item)
		const index = _indexes.get(item)
		if (!layout || index == null)
			return false

		if (checkSizeEqual(layout.rect, size) && layout.estimated === false)
			return false

		// 更新 layout
		layout.estimated = false
		layout.rect.height = size.height
		layout.rect.width = size.width

		_assemble.update(index, getSizeByAxis(size, _axis))

		return true
	}

	const getVisibleItems: Self['getVisibleItems'] = (visibleRect) => {
		const result: { index: number, layout: Layout }[] = []

		if (!_data)
			return result

		_fillSize(visibleRect)

		let i = _indexAt(visibleRect)
		while (i < _data.length && _checkItemVisible(i, visibleRect)) {
			const item = _data[i]
			const layout = _layouts.get(item)
			if (layout)
				result.push({ index: i, layout })
			i += 1
		}

		return result
	}

	const setAxis: Self['setAxis'] = (val) => {
		_axis = val
	}

	const setItemSize: Self['setItemSize'] = (val) => {
		_itemSize = val
	}

	const setEstimatedItemSize: Self['setEstimatedItemSize'] = (val) => {
		_estimatedItemSize = val
	}

	return {
		reload,
		updateItemSize,
		getItem,
		getVisibleItems,
		getContentSize,
		setAxis,
		setItemSize,
		setEstimatedItemSize,
	}
}
