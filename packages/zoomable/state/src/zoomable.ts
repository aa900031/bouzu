import type { AxisValue, Point, Rect, RegisterRafMethods, Size, TransitionRunner } from '@bouzu/shared'
import type { Emitter } from 'mitt'
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
	rafFn?: RegisterRafMethods['raf']
	cafFn?: RegisterRafMethods['caf']
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

export interface ZoomableHandlers extends GestureHandlers {
	Wheel: (event: WheelEventPayload) => void
	DoubleClick: (event: DoubleClickEventPayload) => void
}

export class Zoomable {
	#emitter = mitt<ZoomableEvents>()
	#props: ZoomableProps
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
	#pan: Point
	#startZoom: number
	#startPan: Point
	#timeoutWheel: ReturnType<typeof setTimeout> | null
	#transitionPan: TransitionRunner
	#transitionZoomPan: TransitionRunner

	on: Emitter<ZoomableEvents>['on'] = this.#emitter.on
	off: Emitter<ZoomableEvents>['off'] = this.#emitter.off
	handlers: ZoomableHandlers

	constructor(props: ZoomableProps) {
		this.#props = props
		this.#panBounds = new PanBounds(props)
		this.#gesture = new Gesture({
			getContainerBoundingClientRect: this.#props.getContainerBoundingClientRect,
			onDragStart: this.#handleDragStart,
			onDragChange: this.#handleDragChange,
			onDragEnd: this.#handleDragEnd,
			onZoomStart: this.#handleZoomStart,
			onZoomChange: this.#handleZoomChange,
			onZoomEnd: this.#handleZoomEnd,
			onDoubleTap: this.#handleDoubleClick,
		})

		this.#min = props.min ?? 0.5
		this.#max = props.max ?? 3
		this.#initial = props.initial ?? 1
		this.#animationDuration = props.animationDuration ?? 300
		this.#enablePan = props.enablePan ?? true
		this.#enablePinch = props.enablePinch ?? true
		this.#enableWheel = props.enableWheel ?? true

		this.#currentZoom = this.#initial
		this.#pan = createPoint()
		this.#startZoom = this.#currentZoom
		this.#startPan = createPoint()
		this.#timeoutWheel = null
		this.#transitionPan = runNoopTransition()
		this.#transitionZoomPan = runNoopTransition()

		this.handlers = {
			...this.#gesture.handlers,
			Wheel: this.#handleWheel,
			DoubleClick: this.#handleDoubleClick,
		}
	}

	public updateTo(
		zoom: number,
		center?: Point,
	): void {
		const targetZoom = clamp(zoom, this.#min, this.#max)

		let targetPan = clonePoint(this.#pan)

		if (center) {
			const zoomFactor = targetZoom / this.#currentZoom
			targetPan = createPoint(
				center.x - (center.x - this.#pan.x) * zoomFactor,
				center.y - (center.y - this.#pan.y) * zoomFactor,
			)
		}

		const tempZoom = this.#currentZoom
		this.#currentZoom = targetZoom
		this.#panBounds.update(this.#currentZoom)
		this.#currentZoom = tempZoom

		const correctedPan = this.#panBounds.getCorrectPan(targetPan)
		this.#animateZoomAndPan(targetZoom, correctedPan)
	}

	public updateIn(
		step = 0.2,
	): void {
		this.updateTo(this.#currentZoom + step, { x: 0, y: 0 })
	}

	public updateOut(
		step = 0.2,
	): void {
		this.updateTo(this.#currentZoom - step, { x: 0, y: 0 })
	}

	public reset(): void {
		const targetZoom = this.#initial
		const targetPan = createPoint()
		this.#animateZoomAndPan(targetZoom, targetPan)
	}

	get zoom() {
		return this.#currentZoom
	}

	set zoom(val: number) {
		this.updateTo(val)
	}

	get pan() {
		return this.#pan
	}

	public destroy() {
		this.#emitter.all.clear()
	}

	get min() {
		return this.#min
	}

	set min(value: number) {
		this.#min = value
	}

	get max() {
		return this.#max
	}

	set max(value: number) {
		this.#max = value
	}

	get initial() {
		return this.#initial
	}

	set initial(value: number) {
		this.#initial = value
	}

	get animationDuration() {
		return this.#animationDuration
	}

	set animationDuration(value: number) {
		this.#animationDuration = value
	}

	get enablePan(): boolean {
		return this.#enablePan
	}

	set enablePan(val: boolean) {
		this.#enablePan = val
	}

	get enablePinch() {
		return this.#enablePinch
	}

	set enablePinch(val: boolean) {
		this.#enablePinch = val
	}

	get enableWheel() {
		return this.#enableWheel
	}

	set enableWheel(val: boolean) {
		this.#enableWheel = val
	}

	#handleDragStart = () => {
		this.#transitionPan.cancel()
		this.#transitionZoomPan.cancel()

		this.#startPan = clonePoint(this.#pan)
	}

	#handleDragChange = () => {
		if (!this.#enablePan)
			return

		const delta = this.#gesture.dragDelta

		this.#pan = createPoint(
			this.#pan.x + delta.x,
			this.#pan.y + delta.y,
		)

		this.#applyChanges()
	}

	#handleDragEnd = () => {
		if (!this.#enablePan)
			return

		const correctedPan = this.#panBounds.getCorrectPan(this.#pan)
		const needsBoundaryCorrection
			= Math.abs(correctedPan.x - this.#pan.x) > 0.1
				|| Math.abs(correctedPan.y - this.#pan.y) > 0.1

		const velocity = this.#gesture.velocity
		const decelerationRate = 0.95

		const projectPoint = this.#createProjectPoint(velocity, decelerationRate)
		const projectedPan = createPoint(
			correctedPan.x + projectPoint.x,
			correctedPan.y + projectPoint.y,
		)

		const finalPan = this.#panBounds.getCorrectPan(projectedPan)

		const needsInertiaAnimation
			= Math.abs(finalPan.x - correctedPan.x) > 1
				|| Math.abs(finalPan.y - correctedPan.y) > 1

		if (needsBoundaryCorrection) {
			if (needsInertiaAnimation) {
				this.#animatePan(finalPan)
			}
			else {
				this.#animatePan(correctedPan)
			}
		}
		else if (needsInertiaAnimation) {
			this.#animatePan(finalPan)
		}
	}

	#handleZoomStart = () => {
		this.#transitionPan.cancel()
		this.#transitionZoomPan.cancel()

		this.#startZoom = this.#currentZoom
		this.#startPan = clonePoint(this.#pan)
	}

	#handleZoomChange = () => {
		if (!this.#enablePinch)
			return

		const currentDistance = this.#gesture.zoomDistance
		const startDistance = this.#gesture.startZoomDistance

		if (startDistance > 0) {
			const zoomFactor = currentDistance / startDistance
			let newZoom = this.#startZoom * zoomFactor

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

			const zoomCenter = this.#gesture.zoomCenter
			const containerRect = this.#props.getContainerBoundingClientRect()
			const centerX = containerRect.width / 2
			const centerY = containerRect.height / 2

			const relativeCenterX = zoomCenter.x - centerX
			const relativeCenterY = zoomCenter.y - centerY

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

	#handleZoomEnd = () => {
		this.#correctZoomAndPan()
	}

	#handleDoubleClick = (
		event: DoubleClickEventPayload,
	) => {
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

	#handleWheel = (event: WheelEventPayload) => {
		if (this.#enableWheel === false)
			return

		if (event.withCtrl) {
			const delta = event.delta.y > 0 ? -0.1 : 0.1
			const newZoom = clamp(this.#currentZoom + delta, this.#min, this.#max)

			if (newZoom !== this.#currentZoom) {
				const rect = this.#props.getContainerBoundingClientRect()
				const centerX = rect.width / 2
				const centerY = rect.height / 2

				const zoomCenter = createPoint(
					event.client.x - centerX,
					event.client.y - centerY,
				)
				const zoomFactor = newZoom / this.#currentZoom
				const newPan = createPoint(
					zoomCenter.x - (zoomCenter.x - this.#pan.x) * zoomFactor,
					zoomCenter.y - (zoomCenter.y - this.#pan.y) * zoomFactor,
				)

				this.#currentZoom = newZoom
				this.#pan = newPan
				this.#panBounds.update(this.#currentZoom)
				this.#applyChanges()

				if (this.#timeoutWheel)
					clearTimeout(this.#timeoutWheel)

				this.#timeoutWheel = globalThis.setTimeout(() => {
					this.#correctZoomAndPan()
					this.#timeoutWheel = null
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
				this.#pan.x - delta.x,
				this.#pan.y - delta.y,
			)

			this.#pan = this.#panBounds.getCorrectPan(newPan)
			this.#applyChanges()
		}
	}

	#applyChanges() {
		this.#emitter.emit(ZoomableEventName.ChangeZoom, this.#currentZoom)
		this.#emitter.emit(ZoomableEventName.ChangePan, this.#pan)
	}

	#createProjectPoint(
		velocity: Point,
		decelerationRate: number,
	): Point {
		return createPoint(
			velocity.x * decelerationRate / (1 - decelerationRate),
			velocity.y * decelerationRate / (1 - decelerationRate),
		)
	}

	#animatePan(targetPan: Point) {
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
			raf: this.#props.rafFn,
			caf: this.#props.cafFn,
		})
	}

	#animateZoomAndPan(
		targetZoom: number,
		targetPan: Point,
	) {
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
			raf: this.#props.rafFn,
			caf: this.#props.cafFn,
		})
	}

	#correctZoomAndPan() {
		let needsCorrection = false
		let targetZoom = this.#currentZoom
		let targetPan = clonePoint(this.#pan)

		if (this.#currentZoom < this.#min) {
			targetZoom = this.#min
			needsCorrection = true
		}
		else if (this.#currentZoom > this.#max) {
			targetZoom = this.#max
			needsCorrection = true
		}

		if (targetZoom !== this.#currentZoom) {
			const originalZoom = this.#currentZoom
			this.#currentZoom = targetZoom
			this.#panBounds.update(this.#currentZoom)
			this.#currentZoom = originalZoom
		}

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

	constructor(
		props: {
			getContainerBoundingClientRect: () => Rect
			getElementStyleSize: () => Size
		},
	) {
		this.#props = props
	}

	public update(
		zoom: number,
	) {
		const containerRect = this.#props.getContainerBoundingClientRect()
		const contentSize = this.#props.getElementStyleSize()
		const scaledSize = createSize(
			contentSize.width * zoom,
			contentSize.height * zoom,
		)

		this.#updateAxis(Axis.X, containerRect, scaledSize)
		this.#updateAxis(Axis.Y, containerRect, scaledSize)
	}

	public getCorrectPan(
		offset: Point,
	): Point {
		return createPoint(
			this.#getCorrectPanAxis(Axis.X, offset),
			this.#getCorrectPanAxis(Axis.Y, offset),
		)
	}

	public reset() {
		this.#min = createPoint()
		this.#max = createPoint()
	}

	#updateAxis(
		axis: AxisValue,
		containerSize: Size,
		scaledSize: Size,
	) {
		const container = getSizeByAxis(containerSize, axis)
		const scaled = getSizeByAxis(scaledSize, axis)

		if (scaled > container) {
			const overflow = (scaled - container) / 2
			this.#min[axis] = -overflow
			this.#max[axis] = overflow
		}
		else {
			this.#min[axis] = 0
			this.#max[axis] = 0
		}
	}

	#getCorrectPanAxis(
		axis: AxisValue,
		offset: Point,
	) {
		if (this.#min[axis] === this.#max[axis])
			return this.#min[axis]

		return Math.max(this.#min[axis], Math.min(offset[axis], this.#max[axis]))
	}
}

interface GestureHandlers {
	TouchStart: (event: GestureEventPayload) => void
	TouchMove: (event: GestureEventPayload) => void
	TouchEnd: (event: GestureEventPayload) => void
	MouseDown: (event: GestureEventPayload) => void
	MouseMove: (event: GestureEventPayload) => void
	MouseUp: (event: GestureEventPayload) => void
	GlobalMouseMove: (event: GestureEventPayload) => void
	GlobalMouseUp: (event: GestureEventPayload) => void
}

class Gesture {
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

	#axisSwipeHysteresis = 10
	#velocityHysteresis = 50

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

	public handlers: GestureHandlers = {
		TouchStart: (event: GestureEventPayload) => this.#handleTouchStart(event),
		TouchMove: (event: GestureEventPayload) => this.#handleTouchMove(event),
		TouchEnd: (event: GestureEventPayload) => this.#handleTouchEnd(event),
		MouseDown: (event: GestureEventPayload) => this.#handleMouseDown(event),
		MouseMove: (event: GestureEventPayload) => this.#handleMouseMove(event),
		MouseUp: (event: GestureEventPayload) => this.#handleMouseUp(event),
		GlobalMouseMove: (event: GestureEventPayload) => this.#handleGlobalMouseMove(event),
		GlobalMouseUp: (event: GestureEventPayload) => this.#handleGlobalMouseUp(event),
	}

	constructor(
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
		this.#props = props
	}

	public get velocity() {
		return this.#velocity
	}

	public get zoomDistance() {
		if (this.#numActivePoints > 1)
			return getPointDistance(this.#p1, this.#p2)
		return 0
	}

	public get startZoomDistance() {
		if (this.#numActivePoints > 1)
			return getPointDistance(this.#startP1, this.#startP2)
		return 0
	}

	public get zoomCenter(): Point {
		if (this.#numActivePoints > 1)
			return getPointCenter(this.#p1, this.#p2)
		return clonePoint(this.#p1)
	}

	public get dragDelta(): Point {
		return createPoint(
			this.#p1.x - this.#prevP1.x,
			this.#p1.y - this.#prevP1.y,
		)
	}

	#handleTouchStart = (event: GestureEventPayload) => {
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

	#handleTouchMove = (event: GestureEventPayload) => {
		this.#updatePointsFromTouch(event, 'move')
		this.#onGestureChange()
	}

	#handleTouchEnd = (event: GestureEventPayload) => {
		this.#updatePointsFromTouch(event, 'up')
		this.#onGestureEnd()
	}

	#handleMouseDown = (event: GestureEventPayload) => {
		this.#updatePointsFromMouse(event, 'down')
		this.#onGestureStart()
	}

	#handleMouseMove = (event: GestureEventPayload) => {
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

	#handleMouseUp = (event: GestureEventPayload) => {
		this.#updatePointsFromMouse(event, 'up')
		this.#onGestureEnd()
	}

	#handleGlobalMouseMove = (event: GestureEventPayload) => {
		if (this.#numActivePoints > 0 && !this.#checkPointInContainer(event.touches[0])) {
			if (this.#isDragging) {
				this.#numActivePoints = 0
				this.#onGestureEnd()
			}
		}
	}

	#handleGlobalMouseUp = (event: GestureEventPayload) => {
		if (this.#numActivePoints > 0)
			this.#handleMouseUp(event)
	}

	#updatePointsFromTouch(
		event: GestureEventPayload,
		type: 'down' | 'move' | 'up',
	) {
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

	#updatePointsFromMouse(
		event: GestureEventPayload,
		type: 'down' | 'move' | 'up',
	) {
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

	#onGestureStart() {
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

	#onGestureChange() {
		if (this.#numActivePoints === 1 && !this.#isZooming) {
			if (!this.#isDragging) {
				const diffX = Math.abs(this.#p1.x - this.#startP1.x)
				const diffY = Math.abs(this.#p1.y - this.#startP1.y)

				if (diffX >= this.#axisSwipeHysteresis || diffY >= this.#axisSwipeHysteresis)
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

	#onGestureEnd() {
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

	#updatePrevPoints() {
		this.#prevP1 = clonePoint(this.#p1)
		this.#prevP2 = clonePoint(this.#p2)
	}

	#getTouchPoint(
		touch: GestureEventPayload['touches'][number],
	): Point {
		const containerRect = this.#props.getContainerBoundingClientRect()
		return createPoint(
			touch.client.x - containerRect.x,
			touch.client.y - containerRect.y,
		)
	}

	#updateVelocity(
		force = false,
	): void {
		const currentTime = Date.now()
		const duration = currentTime - this.#intervalTime

		if (duration < this.#velocityHysteresis && !force)
			return

		this.#velocity = createPoint(
			this.#getVelocity(Axis.X, duration),
			this.#getVelocity(Axis.Y, duration),
		)
		this.#intervalTime = currentTime
		this.#intervalP1 = clonePoint(this.#p1)
	}

	#getVelocity(
		axis: AxisValue,
		duration: number,
	): number {
		const displacement = this.#p1[axis] - this.#intervalP1[axis]

		if (Math.abs(displacement) > 1 && duration > 5)
			return displacement / duration

		return 0
	}

	#checkPointInContainer(
		touch: GestureEventPayload['touches'][number],
	): boolean {
		const point = touch.client
		const containerRect = this.#props.getContainerBoundingClientRect()
		return checkRectContainsPoint(containerRect, point)
	}
}
