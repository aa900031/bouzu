import type { AxisValue, Point, Rect, Size, TransitionRunner } from '@bouzu/shared'
import { Axis, checkPointEqualWithTolerance, checkRectContainsPoint, clamp, clonePoint, createPoint, createSize, easeOutCubic, getPointCenter, getPointDistance, getSizeByAxis, runNoopTransition, runTransition } from '@bouzu/shared'
import type { Emitter } from 'mitt'
import mitt from 'mitt'

export interface ZoomableProps {
	getContainerBoundingClientRect: () => Rect
	getElementStyleSize: () => Size
	min?: number
	max?: number
	initial?: number
	animationDuration?: number
	enablePan?: boolean
	enablePinch?: boolean
	enableWheel?: boolean
}

export const ZoomableEventName = {
	ChangeZoom: 'change-zoom',
	ChangePan: 'change-pan',
} as const

// eslint-disable-next-line ts/consistent-type-definitions
export type ZoomableEvents = {
	[ZoomableEventName.ChangePan]: Point
	[ZoomableEventName.ChangeZoom]: number
}

export interface WheelEventPayload {
	client: Point
	delta: Point
	withCtrl: boolean
}

export interface GestureEventPayload {
	touches: {
		client: Point
	}[]
}

export interface DoubleClickEventPayload {
	client: Point
}

export interface Zoomable {
	on: Emitter<ZoomableEvents>['on']
	off: Emitter<ZoomableEvents>['off']
	updateTo: (zoom: number, center?: Point) => void
	updateIn: (step: number) => void
	updateOut: (step: number) => void
	getZoom: () => number
	getPan: () => Point
	reset: () => void
	destroy: () => void
	getMin: () => number
	setMin: (value: number) => void
	getMax: () => number
	setMax: (value: number) => void
	getInitial: () => number
	setInitial: (value: number) => void
	getAnimationDuration: () => number
	setAnimationDuration: (value: number) => void
	setEnablePan: (val: boolean) => void
	getEnablePan: () => boolean
	setEnablePinch: (val: boolean) => void
	getEnablePinch: () => boolean
	setEnableWheel: (val: boolean) => void
	getEnableWheel: () => boolean
	handlers: {
		TouchStart: (event: GestureEventPayload) => void
		TouchMove: (event: GestureEventPayload) => void
		TouchEnd: (event: GestureEventPayload) => void
		MouseDown: (event: GestureEventPayload) => void
		MouseMove: (event: GestureEventPayload) => void
		MouseUp: (event: GestureEventPayload) => void
		GlobalMouseMove: (event: GestureEventPayload) => void
		GlobalMouseUp: (event: GestureEventPayload) => void
		Wheel: (event: WheelEventPayload) => void
		DoubleClick: (event: DoubleClickEventPayload) => void
	}
}

export function createZoomable(
	props: ZoomableProps,
): Zoomable {
	const _emitter = mitt<ZoomableEvents>()
	const _panBounds = createPanBounds(props)
	const _gesture = createGesture({
		...props,
		onDragStart: _handleDragStart,
		onDragChange: _handleDragChange,
		onDragEnd: _handleDragEnd,
		onZoomStart: _handleZoomStart,
		onZoomChange: _handleZoomChange,
		onZoomEnd: _handleZoomEnd,
		onDoubleTap: _handleDoubleClick,
	})

	let _min = props.min ?? 0.5
	let _max = props.max ?? 3
	let _initial = props.initial ?? 1
	let _animationDuration = props.animationDuration ?? 300
	let _enablePan = props.enablePan ?? true
	let _enablePinch = props.enablePinch ?? true
	let _enableWheel = props.enableWheel ?? true

	let _currentZoom: number = _initial
	let _pan: Point = createPoint()
	let _startZoom: number = _currentZoom
	let _startPan: Point = createPoint()
	let _timeoutWheel: number | null = null
	let _transitionPan: TransitionRunner = runNoopTransition()
	let _transitionZoomPan: TransitionRunner = runNoopTransition()

	return {
		on: _emitter.on,
		off: _emitter.off,
		updateTo,
		updateIn,
		updateOut,
		reset,
		getZoom,
		getPan,
		destroy,
		getMin() {
			return _min
		},
		setMin(value: number) {
			_min = value
		},
		getMax() {
			return _max
		},
		setMax(value: number) {
			_max = value
		},
		getInitial() {
			return _initial
		},
		setInitial(value: number) {
			_initial = value
		},
		getAnimationDuration() {
			return _animationDuration
		},
		setAnimationDuration(value: number) {
			_animationDuration = value
		},
		setEnablePan(val: boolean) {
			_enablePan = val
		},
		getEnablePan(): boolean {
			return _enablePan
		},
		setEnablePinch(val: boolean) {
			_enablePinch = val
		},
		getEnablePinch() {
			return _enablePinch
		},
		setEnableWheel(val: boolean) {
			_enableWheel = val
		},
		getEnableWheel() {
			return _enableWheel
		},
		handlers: {
			..._gesture.handlers,
			Wheel: _handleWheel,
			DoubleClick: _handleDoubleClick,
		},
	}

	function updateTo(
		zoom: number,
		center?: Point,
	): void {
		const targetZoom = clamp(zoom, _min, _max)

		let targetPan = clonePoint(_pan)

		if (center) {
			// center 已經是相對於容器中心的座標
			const zoomFactor = targetZoom / _currentZoom
			targetPan = createPoint(
				center.x - (center.x - _pan.x) * zoomFactor,
				center.y - (center.y - _pan.y) * zoomFactor,
			)
		}

		// 計算正確的邊界
		const tempZoom = _currentZoom
		_currentZoom = targetZoom
		_panBounds.update(_currentZoom)
		_currentZoom = tempZoom

		// 修正平移位置
		const correctedPan = _panBounds.getCorrectPan(targetPan)
		_animateZoomAndPan(targetZoom, correctedPan)
	}

	function updateIn(
		step = 0.2,
	): void {
		updateTo(_currentZoom + step, { x: 0, y: 0 })
	}

	function updateOut(
		step = 0.2,
	): void {
		updateTo(_currentZoom - step, { x: 0, y: 0 })
	}

	function reset(): void {
		const targetZoom = _initial
		const targetPan = createPoint()
		_animateZoomAndPan(targetZoom, targetPan)
	}

	function getZoom() {
		return _currentZoom
	}

	function getPan() {
		return _pan
	}

	function destroy() {
		_emitter.all.clear()
	}

	function _handleDragStart() {
		_transitionPan.cancel()
		_transitionZoomPan.cancel()

		_startPan = clonePoint(_pan)
	}

	function _handleDragChange() {
		if (!_enablePan)
			return

		const delta = _gesture.getDragDelta()

		_pan = createPoint(
			_pan.x + delta.x,
			_pan.y + delta.y,
		)

		_applyChanges()
	}

	function _handleDragEnd() {
		if (!_enablePan)
			return

		const correctedPan = _panBounds.getCorrectPan(_pan)
		const needsBoundaryCorrection
			= Math.abs(correctedPan.x - _pan.x) > 0.1
			|| Math.abs(correctedPan.y - _pan.y) > 0.1

		const velocity = _gesture.getVelocity()
		const decelerationRate = 0.95
		const frameMs = 16
		const inertiaMultiplier = 1.25

		const projectPoint = createPoint(
			velocity.x * frameMs / (1 - decelerationRate) * inertiaMultiplier,
			velocity.y * frameMs / (1 - decelerationRate) * inertiaMultiplier,
		)
		const projectedPan = createPoint(
			correctedPan.x + projectPoint.x,
			correctedPan.y + projectPoint.y,
		)
		const finalPan = _panBounds.getCorrectPan(projectedPan)
		const needsInertiaAnimation
			= Math.abs(finalPan.x - correctedPan.x) > 1
			|| Math.abs(finalPan.y - correctedPan.y) > 1

		if (needsBoundaryCorrection) {
			if (needsInertiaAnimation) {
				const inertiaDuration = _computeInertiaDuration(projectPoint, velocity)
				_animatePan(finalPan, inertiaDuration)
			}
			else {
				_animatePan(correctedPan, Math.min(_animationDuration, 200))
			}
		}
		else if (needsInertiaAnimation) {
			const inertiaDuration = _computeInertiaDuration(projectPoint, velocity)
			_animatePan(finalPan, inertiaDuration)
		}
	}

	function _handleZoomStart() {
		_transitionPan.cancel()
		_transitionZoomPan.cancel()

		_startZoom = _currentZoom
		_startPan = clonePoint(_pan)
	}

	function _handleZoomChange() {
		if (!_enablePinch)
			return

		const currentDistance = _gesture.getZoomDistance()
		const startDistance = _gesture.getStartZoomDistance()

		if (startDistance > 0) {
			const zoomFactor = currentDistance / startDistance
			let newZoom = _startZoom * zoomFactor

			const minZoomWithFriction = _min * 0.8
			const maxZoomWithFriction = _max * 1.2

			if (newZoom < _min) {
				newZoom = _min + (newZoom - _min) * 0.3
				newZoom = Math.max(newZoom, minZoomWithFriction)
			}
			else if (newZoom > _max) {
				newZoom = _max + (newZoom - _max) * 0.3
				newZoom = Math.min(newZoom, maxZoomWithFriction)
			}

			const zoomCenter = _gesture.getZoomCenter()
			const containerRect = props.getContainerBoundingClientRect()
			const centerX = containerRect.width / 2
			const centerY = containerRect.height / 2

			const relativeCenterX = zoomCenter.x - centerX
			const relativeCenterY = zoomCenter.y - centerY

			const actualZoomFactor = newZoom / _startZoom
			const newPan = {
				x: relativeCenterX - (relativeCenterX - _startPan.x) * actualZoomFactor,
				y: relativeCenterY - (relativeCenterY - _startPan.y) * actualZoomFactor,
			}

			_currentZoom = newZoom
			_pan = newPan

			_panBounds.update(_currentZoom)
			_applyChanges()
		}
	}

	function _handleZoomEnd() {
		_correctZoomAndPan()
	}

	function _handleDoubleClick(
		event: DoubleClickEventPayload,
	) {
		const rect = props.getContainerBoundingClientRect()
		const centerX = rect.width / 2
		const centerY = rect.height / 2
		const rel = createPoint(
			event.client.x - centerX,
			event.client.y - centerY,
		)
		const targetZoom = _currentZoom > _initial ? _initial : _max
		updateTo(targetZoom, rel)
	}

	function _handleWheel(event: WheelEventPayload) {
		if (_enableWheel === false)
			return

		if (event.withCtrl) {
			const delta = event.delta.y > 0 ? -0.1 : 0.1
			const newZoom = clamp(_currentZoom + delta, _min, _max)

			if (newZoom !== _currentZoom) {
				const rect = props.getContainerBoundingClientRect()
				const centerX = rect.width / 2
				const centerY = rect.height / 2

				const zoomCenter = createPoint(
					event.client.x - centerX,
					event.client.y - centerY,
				)
				const zoomFactor = newZoom / _currentZoom
				const newPan = createPoint(
					zoomCenter.x - (zoomCenter.x - _pan.x) * zoomFactor,
					zoomCenter.y - (zoomCenter.y - _pan.y) * zoomFactor,
				)

				_currentZoom = newZoom
				_pan = newPan
				_panBounds.update(_currentZoom)
				_applyChanges()

				if (_timeoutWheel)
					clearTimeout(_timeoutWheel)

				_timeoutWheel = window.setTimeout(() => {
					_correctZoomAndPan()
					_timeoutWheel = null
				}, 150)
			}
		}
		else {
			const dragSpeed = 1.0
			const delta = createPoint(
				event.delta.x * dragSpeed,
				event.delta.y * dragSpeed,
			)
			const newPan = createPoint(
				_pan.x - delta.x,
				_pan.y - delta.y,
			)

			_pan = _panBounds.getCorrectPan(newPan)
			_applyChanges()
		}
	}

	function _applyChanges() {
		_emitter.emit(ZoomableEventName.ChangeZoom, _currentZoom)
		_emitter.emit(ZoomableEventName.ChangePan, _pan)
	}

	function _animatePan(targetPan: Point, duration?: number) {
		_transitionPan.cancel()

		const startPan = clonePoint(_pan)
		const useDuration = duration ?? _animationDuration

		_transitionPan = runTransition({
			start: 0,
			end: 1,
			duration: useDuration,
			easing: easeOutCubic,
			onUpdate: (progress) => {
				_pan = createPoint(
					startPan.x + (targetPan.x - startPan.x) * progress,
					startPan.y + (targetPan.y - startPan.y) * progress,
				)
				_applyChanges()
			},
		})
	}

	function _computeInertiaDuration(projectPoint: Point, velocity: Point) {
		const distance = Math.hypot(projectPoint.x, projectPoint.y)
		const speed = velocity ? Math.hypot(velocity.x, velocity.y) : 0

		let duration: number
		if (speed > 0.001)
			duration = distance / speed
		else
			duration = distance * 1.2

		duration = Math.max(250, Math.min(2000, duration))

		return Math.round(duration)
	}

	function _animateZoomAndPan(
		targetZoom: number,
		targetPan: Point,
	) {
		_transitionZoomPan.cancel()

		const startZoom = _currentZoom
		const startPan = clonePoint(_pan)

		_transitionZoomPan = runTransition({
			start: 0,
			end: 1,
			duration: _animationDuration,
			onUpdate: (progress) => {
				_pan = createPoint(
					startPan.x + (targetPan.x - startPan.x) * progress,
					startPan.y + (targetPan.y - startPan.y) * progress,
				)
				_currentZoom = startZoom + (targetZoom - startZoom) * progress
				_panBounds.update(_currentZoom)
				_applyChanges()
			},
		})
	}

	function _correctZoomAndPan() {
		let needsCorrection = false
		let targetZoom = _currentZoom
		let targetPan = clonePoint(_pan)

		if (_currentZoom < _min) {
			targetZoom = _min
			needsCorrection = true
		}
		else if (_currentZoom > _max) {
			targetZoom = _max
			needsCorrection = true
		}

		if (targetZoom !== _currentZoom) {
			const originalZoom = _currentZoom
			_currentZoom = targetZoom
			_panBounds.update(_currentZoom)
			_currentZoom = originalZoom
		}

		const correctedPan = _panBounds.getCorrectPan(targetPan)

		if (!checkPointEqualWithTolerance(correctedPan, targetPan, 0.1)) {
			targetPan = correctedPan
			needsCorrection = true
		}

		if (needsCorrection)
			_animateZoomAndPan(targetZoom, targetPan)
	}
}

function createPanBounds(
	props: {
		getContainerBoundingClientRect: () => Rect
		getElementStyleSize: () => Size
	},
) {
	let _min: Point = createPoint()
	let _max: Point = createPoint()
	let _center: Point = createPoint() // TODO: 可以不用

	return {
		update,
		getCorrectPan,
		reset,
	}

	function update(
		zoom: number,
	) {
		const containerRect = props.getContainerBoundingClientRect()
		const contentSize = props.getElementStyleSize()
		const scaledSize = createSize(
			contentSize.width * zoom,
			contentSize.height * zoom,
		)

		_updateAxis(Axis.X, containerRect, scaledSize)
		_updateAxis(Axis.Y, containerRect, scaledSize)
		_updateCenter()
	}

	function getCorrectPan(
		offset: Point,
	): Point {
		return createPoint(
			_getCorrectPanAxis(Axis.X, offset),
			_getCorrectPanAxis(Axis.Y, offset),
		)
	}

	function reset() {
		_min = createPoint()
		_max = createPoint()
		_center = createPoint()
	}

	function _updateAxis(
		axis: AxisValue,
		containerSize: Size,
		scaledSize: Size,
	) {
		const _container = getSizeByAxis(containerSize, axis)
		const _scaled = getSizeByAxis(scaledSize, axis)

		if (_scaled > _container) {
			const overflow = (_scaled - _container) / 2
			_min[axis] = -overflow
			_max[axis] = overflow
		}
		else {
			_min[axis] = 0
			_max[axis] = 0
		}
	}

	function _updateCenter() {
		_center = createPoint(
			(_min.x + _max.x) / 2,
			(_min.y + _max.y) / 2,
		)
	}

	function _getCorrectPanAxis(
		axis: AxisValue,
		offset: Point,
	) {
		if (_min[axis] === _max[axis])
			return _min[axis]

		return Math.max(_min[axis], Math.min(offset[axis], _max[axis]))
	}
}

function createGesture(
	props: {
		getContainerBoundingClientRect: () => Rect
		onDragStart: () => void
		onDragChange: () => void
		onDragEnd: () => void
		onZoomStart: () => void
		onZoomChange: () => void
		onZoomEnd: () => void
		onDoubleTap: (payload: DoubleClickEventPayload) => void
	},
) {
	const AXIS_SWIPE_HYSTERESIS = 10
	const VELOCITY_HYSTERESIS = 50

	let _p1: Point = createPoint()
	let _p2: Point = createPoint()
	let _prevP1: Point = createPoint()
	let _prevP2: Point = createPoint()
	let _startP1: Point = createPoint()
	let _startP2: Point = createPoint()

	let _velocity: Point = createPoint()
	let _dragAxis: AxisValue | null = null

	let _startTime: number = 0
	let _isDragging = false
	let _isZooming = false

	let _numActivePoints: number = 0
	let _intervalTime: number = 0
	let _intervalP1: Point = createPoint()

	let _lastTapTime: number = 0
	let _lastTapPosition: Point = createPoint()

	return {
		getVelocity() {
			return _velocity
		},
		getZoomDistance() {
			if (_numActivePoints > 1)
				return getPointDistance(_p1, _p2)
			return 0
		},
		getStartZoomDistance() {
			if (_numActivePoints > 1)
				return getPointDistance(_startP1, _startP2)
			return 0
		},
		getZoomCenter(): Point {
			if (_numActivePoints > 1)
				return getPointCenter(_p1, _p2)
			return clonePoint(_p1)
		},
		getDragDelta(): Point {
			return createPoint(
				_p1.x - _prevP1.x,
				_p1.y - _prevP1.y,
			)
		},
		handlers: {
			TouchStart: handleTouchStart,
			TouchMove: handleTouchMove,
			TouchEnd: handleTouchEnd,
			MouseDown: handleMouseDown,
			MouseMove: handleMouseMove,
			MouseUp: handleMouseUp,
			GlobalMouseMove: handleGlobalMouseMove,
			GlobalMouseUp: handleGlobalMouseUp,
		},
	}

	function handleTouchStart(event: GestureEventPayload) {
		_updatePointsFromTouch(event, 'down')
		_onGestureStart()

		if (_numActivePoints === 1) {
			const currentTime = Date.now()
			const timeDiff = currentTime - _lastTapTime
			const touch = event.touches[0]
			const rect = props.getContainerBoundingClientRect()
			const currentPosition = createPoint(
				touch.client.x - rect.x,
				touch.client.y - rect.y,
			)
			const distance = getPointDistance(currentPosition, _lastTapPosition)

			// 如果兩次點擊間隔小於 300ms 且位置相差不超過 30px，則視為雙擊
			if (timeDiff < 300 && distance < 30) {
				props.onDoubleTap?.({
					client: currentPosition,
				})
				_lastTapTime = 0
			}
			else {
				_lastTapTime = currentTime
				_lastTapPosition = currentPosition
			}
		}
	}

	function handleTouchMove(event: GestureEventPayload) {
		_updatePointsFromTouch(event, 'move')
		_onGestureChange()
	}

	function handleTouchEnd(event: GestureEventPayload) {
		_updatePointsFromTouch(event, 'up')
		_onGestureEnd()
	}

	function handleMouseDown(event: GestureEventPayload) {
		_updatePointsFromMouse(event, 'down')
		_onGestureStart()
	}

	function handleMouseMove(event: GestureEventPayload) {
		if (_numActivePoints > 0) {
			if (_checkPointInContainer(event.touches[0])) {
				_updatePointsFromMouse(event, 'move')
				_onGestureChange()
			}
			else if (_isDragging) {
				_numActivePoints = 0
				_onGestureEnd()
			}
		}
	}

	function handleMouseUp(event: GestureEventPayload) {
		_updatePointsFromMouse(event, 'up')
		_onGestureEnd()
	}

	function handleGlobalMouseMove(event: GestureEventPayload) {
		if (_numActivePoints > 0 && !_checkPointInContainer(event.touches[0])) {
			if (_isDragging) {
				_numActivePoints = 0
				_onGestureEnd()
			}
		}
	}

	function handleGlobalMouseUp(event: GestureEventPayload) {
		if (_numActivePoints > 0)
			handleMouseUp(event)
	}

	function _updatePointsFromTouch(
		event: GestureEventPayload,
		type: 'down' | 'move' | 'up',
	) {
		_numActivePoints = event.touches.length

		switch (type) {
			case 'down':
			case 'move': {
				if (_numActivePoints >= 1) {
					const touch1 = event.touches[0]
					const point1 = _getTouchPoint(touch1)
					_p1 = clonePoint(point1)

					if (type === 'down')
						_startP1 = clonePoint(point1)
				}

				if (_numActivePoints >= 2) {
					const touch2 = event.touches[1]
					const point2 = _getTouchPoint(touch2)
					_p2 = clonePoint(point2)

					if (type === 'down')
						_startP2 = clonePoint(point2)
				}
				break
			}
		}
	}

	function _updatePointsFromMouse(
		event: GestureEventPayload,
		type: 'down' | 'move' | 'up',
	) {
		const touch = event.touches[0]
		if (!touch)
			return

		const point = _getTouchPoint(touch)

		switch (type) {
			case 'down': {
				_numActivePoints = 1
				_p1 = clonePoint(point)
				_startP1 = clonePoint(point)
				break
			}
			case 'move': {
				_p1 = clonePoint(point)
				break
			}
			case 'up': {
				_numActivePoints = 0
				break
			}
		}
	}

	function _onGestureStart() {
		_startTime = Date.now()
		_intervalTime = _startTime
		_intervalP1 = clonePoint(_p1)

		if (_numActivePoints === 1) {
			_dragAxis = null
			_updatePrevPoints()
		}

		if (_numActivePoints > 1)
			_updatePrevPoints()
	}

	function _onGestureChange() {
		if (_numActivePoints === 1 && !_isZooming) {
			if (!_isDragging) {
				const diffX = Math.abs(_p1.x - _startP1.x)
				const diffY = Math.abs(_p1.y - _startP1.y)

				if (diffX >= AXIS_SWIPE_HYSTERESIS || diffY >= AXIS_SWIPE_HYSTERESIS)
					_dragAxis = diffX > diffY ? 'x' : 'y'

				if (_dragAxis) {
					_isDragging = true
					props.onDragStart?.()
				}
			}

			if (_isDragging && !checkPointEqualWithTolerance(_p1, _prevP1)) {
				_updateVelocity()
				props.onDragChange?.()
			}
		}
		else if (_numActivePoints > 1 && !_isDragging) {
			if (!_isZooming) {
				_isZooming = true
				props.onZoomStart?.()
			}

			if (!checkPointEqualWithTolerance(_p1, _prevP1) || !checkPointEqualWithTolerance(_p2, _prevP2))
				props.onZoomChange?.()
		}

		_updatePrevPoints()
	}

	function _onGestureEnd() {
		if (_numActivePoints === 0) {
			if (_isDragging) {
				_isDragging = false
				_updateVelocity()
				props.onDragEnd?.()
			}

			if (_isZooming) {
				_isZooming = false
				props.onZoomEnd?.()
			}
			_dragAxis = null
		}
	}

	function _updatePrevPoints() {
		_prevP1 = clonePoint(_p1)
		_prevP2 = clonePoint(_p2)
	}

	function _getTouchPoint(
		touch: GestureEventPayload['touches'][number],
	): Point {
		const containerRect = props.getContainerBoundingClientRect()
		return createPoint(
			touch.client.x - containerRect.x,
			touch.client.y - containerRect.y,
		)
	}

	function _updateVelocity(): void {
		const currentTime = Date.now()
		const duration = currentTime - _intervalTime
		if (duration < VELOCITY_HYSTERESIS)
			return

		_velocity = createPoint(
			_getVelocity(Axis.X, duration),
			_getVelocity(Axis.Y, duration),
		)
		_intervalTime = currentTime
		_intervalP1 = clonePoint(_p1)
	}

	function _getVelocity(
		axis: AxisValue,
		duration: number,
	): number {
		const displacement = _p1[axis] - _intervalP1[axis]

		if (Math.abs(displacement) > 1 && duration > 5)
			return displacement / duration

		return 0
	}

	function _checkPointInContainer(
		touch: GestureEventPayload['touches'][number],
	): boolean {
		const point = touch.client
		const containerRect = props.getContainerBoundingClientRect()
		return checkRectContainsPoint(containerRect, point)
	}
}
