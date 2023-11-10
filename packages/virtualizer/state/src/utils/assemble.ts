import { createRollingAverage } from './rolling-average'

export function createAssemble(getItemSize: (index: number) => number | undefined,	getItemPosition: (index: number) => number | undefined,	updateItemPosition: (index: number, value: number) => void) {
	const _avg = createRollingAverage()
	const _updated = new Map<number, number>()
	let _length = 0
	let _lastIndex: number | undefined

	const _getItemMax = (index: number): number | undefined => {
		const size = getItemSize(index)
		const pos = getItemPosition(index)
		if (size == null || pos == null)
			return
		return size + pos
	}

	const _updateNextPosition = (index: number) => {
		const pos = _getItemMax(index)
		if (pos == null)
			return
		updateItemPosition(index + 1, pos)
	}

	const _updateNextPosition2 = (index: number, size: number) => {
		let pos = getItemPosition(index)
		if (pos == null)
			return
		pos += size
		updateItemPosition(index + 1, pos)
	}

	const _sort = () => {
		const indexes = [..._updated.keys()].sort((a, b) => a - b)

		for (const index of indexes) {
			const value = _updated.get(index)
			if (value == null)
				continue

			if (_lastIndex == null || _lastIndex === index - 1)
				_lastIndex = index
			else
				_lastIndex = Math.min(_lastIndex, index)

			_lastIndex = Math.max(0, _lastIndex)

			_updateNextPosition2(index, value)
		}

		_updated.clear()
	}

	const update = (index: number, value: number) => {
		_avg.add(value)
		_updated.set(index, value)
	}

	const consolidate = (
		min: number,
		max: number,
	) => {
		_sort()

		if (_lastIndex == null)
			return

		let pos = getItemPosition(_lastIndex)
		while (pos != null && pos <= max) {
			_updateNextPosition(_lastIndex)
			_lastIndex++
			pos = getItemPosition(_lastIndex)
		}
		if (pos == null)
			_lastIndex--
	}

	const positionAt = (index: number) => {
		if (_lastIndex != null && index > _lastIndex) {
			const pos = getItemPosition(_lastIndex)
			if (pos != null) {
				const offset = (index - _lastIndex) * _avg.get()
				return pos + offset
			}
		}

		return getItemPosition(index)
	}

	const indexAt = (position: number): number => {
		let low = 0
		let high = _length - 1
		let middle = 0
		let middleOffset = 0

		while (low <= high) {
			middle = low + Math.floor((high - low) / 2)
			middleOffset = positionAt(middle) ?? 0

			if (middleOffset === position)
				return middle
			else if (middleOffset < position)
				low = middle + 1
			else if (middleOffset > position)
				high = middle - 1
		}

		return Math.max(0, --low)
	}

	const reset = (length = 0) => {
		_length = length
		_lastIndex = undefined
		_avg.reset()
	}

	return {
		update,
		consolidate,
		positionAt,
		reset,
		indexAt,
	}
}
