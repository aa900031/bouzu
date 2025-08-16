import type { GetTimeFn, Rect } from '@bouzu/shared'
import { cloneRect, createPoint, createRect, getTime as defaultGetTime } from '@bouzu/shared'
import { createRollingAverage } from './utils/rolling-average'

export interface CreateOverscansProps {
	throttleTime?: number
	getTime?: GetTimeFn
}

export interface Overscan {
	collect: () => void
	getRect: () => Rect
	setVisibleRect: (rect: Rect) => void
	setThrottleTime: (val: number) => void
}

export function createOverscan(
	props: CreateOverscansProps = {},
): Overscan {
	type Self = Overscan

	let _throttleTime: number = props.throttleTime ?? 500
	const _getTime = props.getTime ?? defaultGetTime

	let _startTime = 0
	const _avgPref = createRollingAverage()
	const _avgTime = createRollingAverage()
	const _velocity = createPoint(5, 5)
	const _overscanX = createRollingAverage()
	const _overscanY = createRollingAverage()
	let _visibleRect = createRect()

	const durationTime = () => {
		const curr = _getTime()
		const diff = curr - _startTime

		return {
			curr,
			diff,
		}
	}

	const setVisibleRect: Self['setVisibleRect'] = (
		rect,
	) => {
		const { diff: diffTime, curr: currTime } = durationTime()

		if (diffTime < _throttleTime) {
			_avgTime.add(diffTime)

			if (rect.x !== _visibleRect.x && diffTime > 0)
				_velocity.x = (rect.x - _visibleRect.x) / diffTime

			if (rect.y !== _visibleRect.y && diffTime > 0)
				_velocity.y = (rect.y - _visibleRect.y) / diffTime
		}

		_startTime = currTime
		_visibleRect = rect
	}

	const collect: Self['collect'] = () => {
		const { diff: diffTime } = durationTime()
		if (diffTime < 500)
			_avgPref.add(diffTime)

		if (_visibleRect.height > 0) {
			const o = Math.abs(_velocity.y * (_avgTime.get() + _avgPref.get()))
			_overscanY.add(o)
		}

		if (_visibleRect.width > 0) {
			const o = Math.abs(_velocity.x * (_avgTime.get() + _avgPref.get()))
			_overscanX.add(o)
		}
	}

	const getRect: Self['getRect'] = () => {
		const result = cloneRect(_visibleRect)

		const overY = Math.round(Math.min(_visibleRect.height * 2, _overscanY.get()) / 100) * 100
		if (_velocity.y > 0) {
			result.y -= overY * 0.2
			result.height += overY + overY * 0.2
		}
		else {
			result.y -= overY
			result.height += overY + overY * 0.2
		}

		const overX = Math.round(Math.min(_visibleRect.width * 2, _overscanX.get()) / 100) * 100
		if (_velocity.x > 0) {
			result.x -= overX * 0.2
			result.width += overX + overX * 0.2
		}
		else {
			result.x -= overX
			result.width += overX + overX * 0.2
		}

		return result
	}

	const setThrottleTime: Self['setThrottleTime'] = (val) => {
		_throttleTime = val
	}

	return {
		setVisibleRect,
		collect,
		setThrottleTime,
		getRect,
	}
}
