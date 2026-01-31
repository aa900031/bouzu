import type { AxisValue, Point, Rect, Size, TransitionRunner } from '@bouzu/shared'
import { Axis, checkPointEqualWithTolerance, checkRectContainsPoint, clamp, clonePoint, createPoint, createSize, easeOutCubic, getPointCenter, getPointDistance, getSizeByAxis, runNoopTransition, runTransition } from '@bouzu/shared'
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

export class Zoomable {
	#emitter = mitt<ZoomableEvents>()
	#panBounds: PanBounds
	#gesture: Gesture

	#min: number
	#max: number
	#initial: number
	#animationDuration: number
	#enablePan: boolean
	#enablePinch: boolean
	#enableWheel: boolean

	#currentZoom: number
	#pan: Point = createPoint()
	#startZoom: number
	#startPan: Point = createPoint()
	#timeoutWheel: ReturnType<typeof setTimeout> | null = null
	#transitionPan: TransitionRunner = runNoopTransition()
	#transitionZoomPan: TransitionRunner = runNoopTransition()

	#props: ZoomableProps

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

	constructor(props: ZoomableProps) {
		this.#props = props
		this.#min = props.min ?? 0.5
		this.#max = props.max ?? 3
		this.#initial = props.initial ?? 1
		this.#animationDuration = props.animationDuration ?? 300
		this.#enablePan = props.enablePan ?? true
		this.#enablePinch = props.enablePinch ?? true
		this.#enableWheel = props.enableWheel ?? true

		this.#currentZoom = this.#initial
		this.#startZoom = this.#currentZoom

		this.#panBounds = new PanBounds(props)
		this.#gesture = new Gesture({
			...props,
			onDragStart: this.#handleDragStart.bind(this),
			onDragChange: this.#handleDragChange.bind(this),
			onDragEnd: this.#handleDragEnd.bind(this),
			onZoomStart: this.#handleZoomStart.bind(this),
			onZoomChange: this.#handleZoomChange.bind(this),
			onZoomEnd: this.#handleZoomEnd.bind(this),
			onDoubleTap: this.#handleDoubleClick.bind(this),
		})

		this.handlers = {
			...this.#gesture.handlers,
			Wheel: this.#handleWheel.bind(this),
			DoubleClick: this.#handleDoubleClick.bind(this),
		}
	}

	on = this.#emitter.on
	off = this.#emitter.off

	public updateTo(zoom: number, center?: Point): void {
		const targetZoom = clamp(zoom, this.#min, this.#max)

		let targetPan = clonePoint(this.#pan)

		if (center) {
			// center 已經是相對於容器中心的座標
			const zoomFactor = targetZoom / this.#currentZoom
			targetPan = createPoint(
				center.x - (center.x - this.#pan.x) * zoomFactor,
				center.y - (center.y - this.#pan.y) * zoomFactor,
			)
		}

		// 計算正確的邊界
		const tempZoom = this.#currentZoom
		this.#currentZoom = targetZoom
		this.#panBounds.update(this.#currentZoom)
		this.#currentZoom = tempZoom

		// 修正平移位置
		const correctedPan = this.#panBounds.getCorrectPan(targetPan)
		this.#animateZoomAndPan(targetZoom, correctedPan)
	}

	public updateIn(step = 0.2): void {
		this.updateTo(this.#currentZoom + step, { x: 0, y: 0 })
	}

	public updateOut(step = 0.2): void {
		this.updateTo(this.#currentZoom - step, { x: 0, y: 0 })
	}

	public reset(): void {
		const targetZoom = this.#initial
		const targetPan = createPoint()
		this.#animateZoomAndPan(targetZoom, targetPan)
	}

	public get zoom(): number {
		return this.#currentZoom
	}

	public get pan(): Point {
		return this.#pan
	}

	public destroy(): void {
		this.#emitter.all.clear()
	}

	public get min(): number {
		return this.#min
	}

	public set min(value: number) {
		this.#min = value
	}

	public get max(): number {
		return this.#max
	}

	public set max(value: number) {
		this.#max = value
	}

	public get initial(): number {
		return this.#initial
	}

	public set initial(value: number) {
		this.#initial = value
	}

	public get animationDuration(): number {
		return this.#animationDuration
	}

	public set animationDuration(value: number) {
		this.#animationDuration = value
	}

	public get enablePan(): boolean {
		return this.#enablePan
	}

	public set enablePan(val: boolean) {
		this.#enablePan = val
	}

	public get enablePinch(): boolean {
		return this.#enablePinch
	}

	public set enablePinch(val: boolean) {
		this.#enablePinch = val
	}

	public get enableWheel(): boolean {
		return this.#enableWheel
	}

	public set enableWheel(val: boolean) {
		this.#enableWheel = val
	}

	#handleDragStart(): void {
		this.#transitionPan.cancel()
		this.#transitionZoomPan.cancel()

		this.#startPan = clonePoint(this.#pan)
	}

	#handleDragChange(): void {
		if (!this.#enablePan)
			return

		const delta = this.#gesture.getDragDelta()

		this.#pan = createPoint(
			this.#pan.x + delta.x,
			this.#pan.y + delta.y,
		)

		this.#applyChanges()
	}

	#handleDragEnd(): void {
		if (!this.#enablePan)
			return

		// 首先修正當前位置到邊界內
		const correctedPan = this.#panBounds.getCorrectPan(this.#pan)

		// 檢查是否需要立即修正邊界
		const needsBoundaryCorrection
			= Math.abs(correctedPan.x - this.#pan.x) > 0.1
				|| Math.abs(correctedPan.y - this.#pan.y) > 0.1

		// 應用慣性
		const velocity = this.#gesture.getVelocity()
		const decelerationRate = 0.95

		// 計算最終位置（從修正後的位置開始）
		const projectPoint = this.#createProjectPoint(velocity, decelerationRate)
		const projectedPan = createPoint(
			correctedPan.x + projectPoint.x,
			correctedPan.y + projectPoint.y,
		)

		// 修正邊界
		const finalPan = this.#panBounds.getCorrectPan(projectedPan)

		// 檢查是否需要動畫
		const needsInertiaAnimation
			= Math.abs(finalPan.x - correctedPan.x) > 1
				|| Math.abs(finalPan.y - correctedPan.y) > 1

		if (needsBoundaryCorrection) {
			// 如果超出邊界，優先修正邊界
			if (needsInertiaAnimation) {
				// 有慣性且需要邊界修正，動畫到最終位置
				this.#animatePan(finalPan)
			}
			else {
				// 只需要邊界修正，動畫到邊界內
				this.#animatePan(correctedPan)
			}
		}
		else if (needsInertiaAnimation) {
			// 在邊界內但有慣性，動畫到最終位置
			this.#animatePan(finalPan)
		}
		// 如果既不需要邊界修正也沒有明顯慣性，不執行動畫
	}

	#handleZoomStart(): void {
		this.#transitionPan.cancel()
		this.#transitionZoomPan.cancel()

		this.#startZoom = this.#currentZoom
		this.#startPan = clonePoint(this.#pan)
	}

	#handleZoomChange(): void {
		if (!this.#enablePinch)
			return

		const currentDistance = this.#gesture.getZoomDistance()
		const startDistance = this.#gesture.getStartZoomDistance()

		if (startDistance > 0) {
			const zoomFactor = currentDistance / startDistance
			let newZoom = this.#startZoom * zoomFactor

			// 限制縮放範圍，但允許輕微超出以提供反饋
			const minZoomWithFriction = this.#min * 0.8
			const maxZoomWithFriction = this.#max * 1.2

			if (newZoom < this.#min) {
				newZoom = this.#min + (newZoom - this.#min) * 0.3
				newZoom = Math.max(newZoom, minZoomWithFriction)
			}
			else if (newZoom > this.#max) {
				newZoom = this.#max + (newZoom - this.#max) * 0.3
				newZoom = Math.min(newZoom, maxZoomWithFriction)
			}

			// 獲取縮放中心點（相對於容器中心）
			const zoomCenter = this.#gesture.getZoomCenter()
			const containerRect = this.#props.getContainerBoundingClientRect()
			const centerX = containerRect.width / 2
			const centerY = containerRect.height / 2

			const relativeCenterX = zoomCenter.x - centerX
			const relativeCenterY = zoomCenter.y - centerY

			// 計算新的平移位置以保持縮放中心點固定
			const actualZoomFactor = newZoom / this.#startZoom
			const newPan = {
				x: relativeCenterX - (relativeCenterX - this.#startPan.x) * actualZoomFactor,
				y: relativeCenterY - (relativeCenterY - this.#startPan.y) * actualZoomFactor,
			}

			this.#currentZoom = newZoom
			this.#pan = newPan

			this.#panBounds.update(this.#currentZoom)
			this.#applyChanges()
		}
	}

	#handleZoomEnd(): void {
		this.#correctZoomAndPan()
	}

	#handleDoubleClick(event: DoubleClickEventPayload): void {
		const rect = this.#props.getContainerBoundingClientRect()
		const centerX = rect.width / 2
		const centerY = rect.height / 2
		const rel = createPoint(
			event.client.x - centerX,
			event.client.y - centerY,
		)
		const targetZoom = this.#currentZoom > this.#initial ? this.#initial : this.#max
		this.updateTo(targetZoom, rel)
	}

	#handleWheel(event: WheelEventPayload): void {
		if (this.#enableWheel === false)
			return

		// 檢查是否按下 Ctrl 鍵來決定是縮放還是拖曳
		if (event.withCtrl) {
			// Ctrl + 滾輪 = 縮放
			const delta = event.delta.y > 0 ? -0.1 : 0.1
			const newZoom = clamp(this.#currentZoom + delta, this.#min, this.#max)

			if (newZoom !== this.#currentZoom) {
				// 獲取滑鼠位置作為縮放中心（相對於容器中心）
				const rect = this.#props.getContainerBoundingClientRect()
				const centerX = rect.width / 2
				const centerY = rect.height / 2

				const zoomCenter = createPoint(
					event.client.x - centerX,
					event.client.y - centerY,
				)
				// 計算新的平移位置
				const zoomFactor = newZoom / this.#currentZoom
				const newPan = createPoint(
					zoomCenter.x - (zoomCenter.x - this.#pan.x) * zoomFactor,
					zoomCenter.y - (zoomCenter.y - this.#pan.y) * zoomFactor,
				)

				this.#currentZoom = newZoom
				this.#pan = newPan
				this.#panBounds.update(this.#currentZoom)
				this.#applyChanges()

				// 清除之前的計時器
				if (this.#timeoutWheel)
					clearTimeout(this.#timeoutWheel)

				// 設置新的計時器，在滾輪事件結束後執行邊界檢查
				this.#timeoutWheel = setTimeout(() => {
					this.#correctZoomAndPan()
					this.#timeoutWheel = null
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
				this.#pan.x - delta.x, // 負號讓滾動方向符合直覺
				this.#pan.y - delta.y,
			)

			// 滾輪拖曳時立即應用邊界限制，不使用動畫
			this.#pan = this.#panBounds.getCorrectPan(newPan)
			this.#applyChanges()
		}
	}

	#applyChanges(): void {
		this.#emitter.emit(ZoomableEventName.ChangeZoom, this.#currentZoom)
		this.#emitter.emit(ZoomableEventName.ChangePan, this.#pan)
	}

	#createProjectPoint(velocity: Point, decelerationRate: number): Point {
		return createPoint(
			velocity.x * decelerationRate / (1 - decelerationRate),
			velocity.y * decelerationRate / (1 - decelerationRate),
		)
	}

	#animatePan(targetPan: Point): void {
		this.#transitionPan.cancel()

		const startPan = clonePoint(this.#pan)

		this.#transitionPan = runTransition({
			start: 0,
			end: 1,
			duration: this.#animationDuration,
			easing: easeOutCubic,
			onUpdate: (progress) => {
				this.#pan = createPoint(
					startPan.x + (targetPan.x - startPan.x) * progress,
					startPan.y + (targetPan.y - startPan.y) * progress,
				)
				this.#applyChanges()
			},
		})
	}

	#animateZoomAndPan(targetZoom: number, targetPan: Point): void {
		this.#transitionZoomPan.cancel()

		const startZoom = this.#currentZoom
		const startPan = clonePoint(this.#pan)

		this.#transitionZoomPan = runTransition({
			start: 0,
			end: 1,
			duration: this.#animationDuration,
			onUpdate: (progress) => {
				this.#pan = createPoint(
					startPan.x + (targetPan.x - startPan.x) * progress,
					startPan.y + (targetPan.y - startPan.y) * progress,
				)
				this.#currentZoom = startZoom + (targetZoom - startZoom) * progress
				this.#panBounds.update(this.#currentZoom)
				this.#applyChanges()
			},
		})
	}

	#correctZoomAndPan(): void {
		let needsCorrection = false
		let targetZoom = this.#currentZoom
		let targetPan = clonePoint(this.#pan)

		// 檢查縮放範圍
		if (this.#currentZoom < this.#min) {
			targetZoom = this.#min
			needsCorrection = true
		}
		else if (this.#currentZoom > this.#max) {
			targetZoom = this.#max
			needsCorrection = true
		}

		// 如果縮放需要修正，重新計算邊界
		if (targetZoom !== this.#currentZoom) {
			// 暫時設置目標縮放來計算正確的邊界
			const originalZoom = this.#currentZoom
			this.#currentZoom = targetZoom
			this.#panBounds.update(this.#currentZoom)
			this.#currentZoom = originalZoom // 恢復原來的縮放
		}

		// 檢查平移邊界
		const correctedPan = this.#panBounds.getCorrectPan(targetPan)

		if (!checkPointEqualWithTolerance(correctedPan, targetPan, 0.1)) {
			targetPan = correctedPan
			needsCorrection = true
		}

		if (needsCorrection)
			this.#animateZoomAndPan(targetZoom, targetPan)
	}
}

class PanBounds {
	#props: {
		getContainerBoundingClientRect: () => Rect
		getElementStyleSize: () => Size
	}

	#min: Point = createPoint()
	#max: Point = createPoint()
	#center: Point = createPoint() // TODO: 可以不用

	constructor(props: {
		getContainerBoundingClientRect: () => Rect
		getElementStyleSize: () => Size
	}) {
		this.#props = props
	}

	update(zoom: number): void {
		const containerRect = this.#props.getContainerBoundingClientRect()
		const contentSize = this.#props.getElementStyleSize()
		const scaledSize = createSize(
			contentSize.width * zoom,
			contentSize.height * zoom,
		)

		this.#updateAxis(Axis.X, containerRect, scaledSize)
		this.#updateAxis(Axis.Y, containerRect, scaledSize)
		this.#updateCenter()
	}

	getCorrectPan(offset: Point): Point {
		return createPoint(
			this.#getCorrectPanAxis(Axis.X, offset),
			this.#getCorrectPanAxis(Axis.Y, offset),
		)
	}

	reset(): void {
		this.#min = createPoint()
		this.#max = createPoint()
		this.#center = createPoint()
	}

	#updateAxis(axis: AxisValue, containerSize: Size, scaledSize: Size): void {
		const _container = getSizeByAxis(containerSize, axis)
		const _scaled = getSizeByAxis(scaledSize, axis)

		if (_scaled > _container) {
			const overflow = (_scaled - _container) / 2
			this.#min[axis] = -overflow
			this.#max[axis] = overflow
		}
		else {
			this.#min[axis] = 0
			this.#max[axis] = 0
		}
	}

	#updateCenter(): void {
		this.#center = createPoint(
			(this.#min.x + this.#max.x) / 2,
			(this.#min.y + this.#max.y) / 2,
		)
	}

	#getCorrectPanAxis(axis: AxisValue, offset: Point): number {
		if (this.#min[axis] === this.#max[axis])
			return this.#min[axis]

		return Math.max(this.#min[axis], Math.min(offset[axis], this.#max[axis]))
	}
}

class Gesture {
	#AXIS_SWIPE_HYSTERESIS = 10
	#VELOCITY_HYSTERESIS = 50

	#p1: Point = createPoint()
	#p2: Point = createPoint()
	#prevP1: Point = createPoint()
	#prevP2: Point = createPoint()
	#startP1: Point = createPoint()
	#startP2: Point = createPoint()

	#velocity: Point = createPoint()
	#dragAxis: AxisValue | null = null

	#startTime: number = 0
	#isDragging = false
	#isZooming = false

	#numActivePoints: number = 0
	#intervalTime: number = 0
	#intervalP1: Point = createPoint()

	#lastTapTime: number = 0
	#lastTapPosition: Point = createPoint()

	#props: {
		getContainerBoundingClientRect: () => Rect
		onDragStart: () => void
		onDragChange: () => void
		onDragEnd: () => void
		onZoomStart: () => void
		onZoomChange: () => void
		onZoomEnd: () => void
		onDoubleTap: (payload: DoubleClickEventPayload) => void
	}

	handlers: {
		TouchStart: (event: GestureEventPayload) => void
		TouchMove: (event: GestureEventPayload) => void
		TouchEnd: (event: GestureEventPayload) => void
		MouseDown: (event: GestureEventPayload) => void
		MouseMove: (event: GestureEventPayload) => void
		MouseUp: (event: GestureEventPayload) => void
		GlobalMouseMove: (event: GestureEventPayload) => void
		GlobalMouseUp: (event: GestureEventPayload) => void
	}

	constructor(props: {
		getContainerBoundingClientRect: () => Rect
		onDragStart: () => void
		onDragChange: () => void
		onDragEnd: () => void
		onZoomStart: () => void
		onZoomChange: () => void
		onZoomEnd: () => void
		onDoubleTap: (payload: DoubleClickEventPayload) => void
	}) {
		this.#props = props
		this.handlers = {
			TouchStart: this.#handleTouchStart.bind(this),
			TouchMove: this.#handleTouchMove.bind(this),
			TouchEnd: this.#handleTouchEnd.bind(this),
			MouseDown: this.#handleMouseDown.bind(this),
			MouseMove: this.#handleMouseMove.bind(this),
			MouseUp: this.#handleMouseUp.bind(this),
			GlobalMouseMove: this.#handleGlobalMouseMove.bind(this),
			GlobalMouseUp: this.#handleGlobalMouseUp.bind(this),
		}
	}

	getVelocity(): Point {
		return this.#velocity
	}

	getZoomDistance(): number {
		if (this.#numActivePoints > 1)
			return getPointDistance(this.#p1, this.#p2)
		return 0
	}

	getStartZoomDistance(): number {
		if (this.#numActivePoints > 1)
			return getPointDistance(this.#startP1, this.#startP2)
		return 0
	}

	getZoomCenter(): Point {
		if (this.#numActivePoints > 1)
			return getPointCenter(this.#p1, this.#p2)
		return clonePoint(this.#p1)
	}

	getDragDelta(): Point {
		return createPoint(
			this.#p1.x - this.#prevP1.x,
			this.#p1.y - this.#prevP1.y,
		)
	}

	#handleTouchStart(event: GestureEventPayload): void {
		this.#updatePointsFromTouch(event, 'down')
		this.#onGestureStart()

		if (this.#numActivePoints === 1) {
			const currentTime = Date.now()
			const timeDiff = currentTime - this.#lastTapTime
			const touch = event.touches[0]
			const rect = this.#props.getContainerBoundingClientRect()
			const currentPosition = createPoint(
				touch.client.x - rect.x,
				touch.client.y - rect.y,
			)
			const distance = getPointDistance(currentPosition, this.#lastTapPosition)

			// 如果兩次點擊間隔小於 300ms 且位置相差不超過 30px，則視為雙擊
			if (timeDiff < 300 && distance < 30) {
				this.#props.onDoubleTap?.({
					client: currentPosition,
				})
				this.#lastTapTime = 0
			}
			else {
				this.#lastTapTime = currentTime
				this.#lastTapPosition = currentPosition
			}
		}
	}

	#handleTouchMove(event: GestureEventPayload): void {
		this.#updatePointsFromTouch(event, 'move')
		this.#onGestureChange()
	}

	#handleTouchEnd(event: GestureEventPayload): void {
		this.#updatePointsFromTouch(event, 'up')
		this.#onGestureEnd()
	}

	#handleMouseDown(event: GestureEventPayload): void {
		this.#updatePointsFromMouse(event, 'down')
		this.#onGestureStart()
	}

	#handleMouseMove(event: GestureEventPayload): void {
		if (this.#numActivePoints > 0) {
			if (this.#checkPointInContainer(event.touches[0])) {
				this.#updatePointsFromMouse(event, 'move')
				this.#onGestureChange()
			}
			else if (this.#isDragging) {
				this.#numActivePoints = 0
				this.#onGestureEnd()
			}
		}
	}

	#handleMouseUp(event: GestureEventPayload): void {
		this.#updatePointsFromMouse(event, 'up')
		this.#onGestureEnd()
	}

	#handleGlobalMouseMove(event: GestureEventPayload): void {
		if (this.#numActivePoints > 0 && !this.#checkPointInContainer(event.touches[0])) {
			if (this.#isDragging) {
				this.#numActivePoints = 0
				this.#onGestureEnd()
			}
		}
	}

	#handleGlobalMouseUp(event: GestureEventPayload): void {
		if (this.#numActivePoints > 0)
			this.#handleMouseUp(event)
	}

	#updatePointsFromTouch(event: GestureEventPayload, type: 'down' | 'move' | 'up'): void {
		this.#numActivePoints = event.touches.length

		switch (type) {
			case 'down':
			case 'move': {
				if (this.#numActivePoints >= 1) {
					const touch1 = event.touches[0]
					const point1 = this.#getTouchPoint(touch1)
					this.#p1 = clonePoint(point1)

					if (type === 'down')
						this.#startP1 = clonePoint(point1)
				}

				if (this.#numActivePoints >= 2) {
					const touch2 = event.touches[1]
					const point2 = this.#getTouchPoint(touch2)
					this.#p2 = clonePoint(point2)

					if (type === 'down')
						this.#startP2 = clonePoint(point2)
				}
				break
			}
		}
	}

	#updatePointsFromMouse(event: GestureEventPayload, type: 'down' | 'move' | 'up'): void {
		const touch = event.touches[0]
		if (!touch)
			return

		const point = this.#getTouchPoint(touch)

		switch (type) {
			case 'down': {
				this.#numActivePoints = 1
				this.#p1 = clonePoint(point)
				this.#startP1 = clonePoint(point)
				break
			}
			case 'move': {
				this.#p1 = clonePoint(point)
				break
			}
			case 'up': {
				this.#numActivePoints = 0
				break
			}
		}
	}

	#onGestureStart(): void {
		this.#startTime = Date.now()
		this.#intervalTime = this.#startTime
		this.#intervalP1 = clonePoint(this.#p1)

		if (this.#numActivePoints === 1) {
			this.#dragAxis = null
			this.#updatePrevPoints()
		}

		if (this.#numActivePoints > 1)
			this.#updatePrevPoints()
	}

	#onGestureChange(): void {
		if (this.#numActivePoints === 1 && !this.#isZooming) {
			if (!this.#isDragging) {
				const diffX = Math.abs(this.#p1.x - this.#startP1.x)
				const diffY = Math.abs(this.#p1.y - this.#startP1.y)

				if (diffX >= this.#AXIS_SWIPE_HYSTERESIS || diffY >= this.#AXIS_SWIPE_HYSTERESIS)
					this.#dragAxis = diffX > diffY ? 'x' : 'y'

				if (this.#dragAxis) {
					this.#isDragging = true
					this.#props.onDragStart?.()
				}
			}

			if (this.#isDragging && !checkPointEqualWithTolerance(this.#p1, this.#prevP1)) {
				this.#updateVelocity()
				this.#props.onDragChange?.()
			}
		}
		else if (this.#numActivePoints > 1 && !this.#isDragging) {
			if (!this.#isZooming) {
				this.#isZooming = true
				this.#props.onZoomStart?.()
			}

			if (!checkPointEqualWithTolerance(this.#p1, this.#prevP1) || !checkPointEqualWithTolerance(this.#p2, this.#prevP2))
				this.#props.onZoomChange?.()
		}

		this.#updatePrevPoints()
	}

	#onGestureEnd(): void {
		if (this.#numActivePoints === 0) {
			if (this.#isDragging) {
				this.#isDragging = false
				this.#updateVelocity(true)
				this.#props.onDragEnd?.()
			}

			if (this.#isZooming) {
				this.#isZooming = false
				this.#props.onZoomEnd?.()
			}
			this.#dragAxis = null
		}
	}

	#updatePrevPoints(): void {
		this.#prevP1 = clonePoint(this.#p1)
		this.#prevP2 = clonePoint(this.#p2)
	}

	#getTouchPoint(touch: GestureEventPayload['touches'][number]): Point {
		const containerRect = this.#props.getContainerBoundingClientRect()
		return createPoint(
			touch.client.x - containerRect.x,
			touch.client.y - containerRect.y,
		)
	}

	#updateVelocity(force = false): void {
		const currentTime = Date.now()
		const duration = currentTime - this.#intervalTime

		if (duration < this.#VELOCITY_HYSTERESIS && !force)
			return

		this.#velocity = createPoint(
			this.#getVelocity(Axis.X, duration),
			this.#getVelocity(Axis.Y, duration),
		)
		this.#intervalTime = currentTime
		this.#intervalP1 = clonePoint(this.#p1)
	}

	#getVelocity(axis: AxisValue, duration: number): number {
		const displacement = this.#p1[axis] - this.#intervalP1[axis]

		if (Math.abs(displacement) > 1 && duration > 5)
			return displacement / duration

		return 0
	}

	#checkPointInContainer(touch: GestureEventPayload['touches'][number]): boolean {
		const point = touch.client
		const containerRect = this.#props.getContainerBoundingClientRect()
		return checkRectContainsPoint(containerRect, point)
	}
}
