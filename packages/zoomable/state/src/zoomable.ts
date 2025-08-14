import type { AxisValue, Point, Rect, Size, TransitionRunner } from '@bouzu/shared'
import { Axis, checkPointEqualWithTolerance, checkRectContainsPoint, clamp, clonePoint, createPoint, createSize, easeOutCubic, getPointCenter, getPointDistance, getSizeByAxis, runNoopTransition, runTransition } from '@bouzu/shared'
import type { Emitter } from 'mitt'
import mitt from 'mitt'

export interface ZoomableOptions {
	min?: number
	max?: number
	initial?: number
	animationDuration?: number
}

export interface ZoomableProps {
	getContainerBoundingClientRect: () => Rect
	getElementStyleSize: () => Size
	options?: ZoomableOptions
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
	const _options: Required<ZoomableOptions> = {
		min: props.options?.min ?? 0.5,
		max: props.options?.max ?? 3,
		initial: props.options?.initial ?? 1,
		animationDuration: props.options?.animationDuration ?? 300,
	}
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
	})

	let _currentZoom: number = _options.initial
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
		const targetZoom = clamp(zoom, _options.min, _options.max)

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
		const targetZoom = _options.initial
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
		const delta = _gesture.getDragDelta()

		_pan = createPoint(
			_pan.x + delta.x,
			_pan.y + delta.y,
		)

		_applyChanges()
	}

	function _handleDragEnd() {
		// 首先修正當前位置到邊界內
		const correctedPan = _panBounds.getCorrectPan(_pan)

		// 檢查是否需要立即修正邊界
		const needsBoundaryCorrection
			= Math.abs(correctedPan.x - _pan.x) > 0.1
			|| Math.abs(correctedPan.y - _pan.y) > 0.1

		// 應用慣性
		const velocity = _gesture.getVelocity()
		const decelerationRate = 0.95

		// 計算最終位置（從修正後的位置開始）
		const projectPoint = _createProjectPoint(velocity, decelerationRate)
		const projectedPan = createPoint(
			correctedPan.x + projectPoint.x,
			correctedPan.y + projectPoint.y,
		)

		// 修正邊界
		const finalPan = _panBounds.getCorrectPan(projectedPan)

		// 檢查是否需要動畫
		const needsInertiaAnimation
			= Math.abs(finalPan.x - correctedPan.x) > 1
			|| Math.abs(finalPan.y - correctedPan.y) > 1

		if (needsBoundaryCorrection) {
			// 如果超出邊界，優先修正邊界
			if (needsInertiaAnimation) {
				// 有慣性且需要邊界修正，動畫到最終位置
				_animatePan(finalPan)
			}
			else {
				// 只需要邊界修正，動畫到邊界內
				_animatePan(correctedPan)
			}
		}
		else if (needsInertiaAnimation) {
			// 在邊界內但有慣性，動畫到最終位置
			_animatePan(finalPan)
		}
		// 如果既不需要邊界修正也沒有明顯慣性，不執行動畫
	}

	function _handleZoomStart() {
		_transitionPan.cancel()
		_transitionZoomPan.cancel()

		_startZoom = _currentZoom
		_startPan = clonePoint(_pan)
	}

	function _handleZoomChange() {
		const currentDistance = _gesture.getZoomDistance()
		const startDistance = _gesture.getStartZoomDistance()

		if (startDistance > 0) {
			const zoomFactor = currentDistance / startDistance
			let newZoom = _startZoom * zoomFactor

			// 限制縮放範圍，但允許輕微超出以提供反饋
			const minZoomWithFriction = _options.min * 0.8
			const maxZoomWithFriction = _options.max * 1.2

			if (newZoom < _options.min) {
				newZoom = _options.min + (newZoom - _options.min) * 0.3
				newZoom = Math.max(newZoom, minZoomWithFriction)
			}
			else if (newZoom > _options.max) {
				newZoom = _options.max + (newZoom - _options.max) * 0.3
				newZoom = Math.min(newZoom, maxZoomWithFriction)
			}

			// 獲取縮放中心點（相對於容器中心）
			const zoomCenter = _gesture.getZoomCenter()
			const containerRect = props.getContainerBoundingClientRect()
			const centerX = containerRect.width / 2
			const centerY = containerRect.height / 2

			const relativeCenterX = zoomCenter.x - centerX
			const relativeCenterY = zoomCenter.y - centerY

			// 計算新的平移位置以保持縮放中心點固定
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
		const targetZoom = _currentZoom > _options.initial ? _options.initial : _options.max
		updateTo(targetZoom, rel)
	}

	function _handleWheel(event: WheelEventPayload) {
		// 檢查是否按下 Ctrl 鍵來決定是縮放還是拖曳
		if (event.withCtrl) {
			// Ctrl + 滾輪 = 縮放
			const delta = event.delta.y > 0 ? -0.1 : 0.1
			const newZoom = clamp(_currentZoom + delta, _options.min, _options.max)

			if (newZoom !== _currentZoom) {
				// 獲取滑鼠位置作為縮放中心（相對於容器中心）
				const rect = props.getContainerBoundingClientRect()
				const centerX = rect.width / 2
				const centerY = rect.height / 2

				const zoomCenter = createPoint(
					event.client.x - centerX,
					event.client.y - centerY,
				)
				// 計算新的平移位置
				const zoomFactor = newZoom / _currentZoom
				const newPan = createPoint(
					zoomCenter.x - (zoomCenter.x - _pan.x) * zoomFactor,
					zoomCenter.y - (zoomCenter.y - _pan.y) * zoomFactor,
				)

				_currentZoom = newZoom
				_pan = newPan
				_panBounds.update(_currentZoom)
				_applyChanges()

				// 清除之前的計時器
				if (_timeoutWheel)
					clearTimeout(_timeoutWheel)

				// 設置新的計時器，在滾輪事件結束後執行邊界檢查
				_timeoutWheel = window.setTimeout(() => {
					_correctZoomAndPan()
					_timeoutWheel = null
				}, 150)
			}
		}
		else {
			// 滾輪的拖曳行為：垂直滾動對應垂直拖曳，水平滾動（如果支援）對應水平拖曳
			const dragSpeed = 1.0 // 調整拖曳靈敏度
			const delta = createPoint(
				event.delta.x * dragSpeed,
				event.delta.y * dragSpeed,
			)

			// 更新平移位置
			const newPan = createPoint(
				_pan.x - delta.x, // 負號讓滾動方向符合直覺
				_pan.y - delta.y,
			)

			// 滾輪拖曳時立即應用邊界限制，不使用動畫
			_pan = _panBounds.getCorrectPan(newPan)
			_applyChanges()
		}
	}

	function _applyChanges() {
		_emitter.emit(ZoomableEventName.ChangeZoom, _currentZoom)
		_emitter.emit(ZoomableEventName.ChangePan, _pan)
	}

	function _createProjectPoint(
		velocity: Point,
		decelerationRate: number,
	): Point {
		return createPoint(
			velocity.x * decelerationRate / (1 - decelerationRate),
			velocity.y * decelerationRate / (1 - decelerationRate),
		)
	}

	function _animatePan(targetPan: Point) {
		_transitionPan.cancel()

		const startPan = clonePoint(_pan)

		_transitionPan = runTransition({
			start: 0,
			end: 1,
			duration: _options.animationDuration,
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
			duration: _options.animationDuration,
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

		// 檢查縮放範圍
		if (_currentZoom < _options.min) {
			targetZoom = _options.min
			needsCorrection = true
		}
		else if (_currentZoom > _options.max) {
			targetZoom = _options.max
			needsCorrection = true
		}

		// 如果縮放需要修正，重新計算邊界
		if (targetZoom !== _currentZoom) {
			// 暫時設置目標縮放來計算正確的邊界
			const originalZoom = _currentZoom
			_currentZoom = targetZoom
			_panBounds.update(_currentZoom)
			_currentZoom = originalZoom // 恢復原來的縮放
		}

		// 檢查平移邊界
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

	const velocity: Point = createPoint()
	let _dragAxis: AxisValue | null = null // TODO: 可以移除?

	let _startTime: number = 0
	let _isDragging = false
	let _isZooming = false
	let _isMultitouch = false // TODO: 可以移除?

	let _numActivePoints: number = 0
	let _intervalTime: number = 0
	let _intervalP1: Point = createPoint()

	return {
		getVelocity() {
			return velocity
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

		if (_numActivePoints > 1) {
			_isMultitouch = true
			_updatePrevPoints()
		}
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
				_updateVelocity(true)
				props.onDragEnd?.()
			}

			if (_isZooming) {
				_isZooming = false
				props.onZoomEnd?.()
			}

			_isMultitouch = false
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

	function _updateVelocity(
		force = false,
	): void {
		const time = Date.now()
		const duration = time - _intervalTime

		if (duration < VELOCITY_HYSTERESIS && !force)
			return

		velocity.x = _getVelocity(Axis.X, duration)
		velocity.y = _getVelocity(Axis.Y, duration)

		_intervalTime = time
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
		const point = createPoint(touch.client.x, touch.client.y)
		const containerRect = props.getContainerBoundingClientRect()
		return checkRectContainsPoint(containerRect, point)
	}
}
