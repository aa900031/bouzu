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
	#timeoutWheel: any = null
	#transitionPan: TransitionRunner = runNoopTransition()
	#transitionZoomPan: TransitionRunner = runNoopTransition()

	#props: ZoomableProps

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
	}

	on = this.#emitter.on
	off = this.#emitter.off

	public updateTo(zoom: number, center?: Point): void {
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

	public destroy() {
		this.#emitter.all.clear()
	}

	public get min() {
		return this.#min
	}

	public set min(value: number) {
		this.#min = value
	}

	public get max() {
		return this.#max
	}

	public set max(value: number) {
		this.#max = value
	}

	public get initial() {
		return this.#initial
	}

	public set initial(value: number) {
		this.#initial = value
	}

	public get animationDuration() {
		return this.#animationDuration
	}

	public set animationDuration(value: number) {
		this.#animationDuration = value
	}

	public get enablePan() {
		return this.#enablePan
	}

	public set enablePan(val: boolean) {
		this.#enablePan = val
	}

	public get enablePinch() {
		return this.#enablePinch
	}

	public set enablePinch(val: boolean) {
		this.#enablePinch = val
	}

	public get enableWheel() {
		return this.#enableWheel
	}

	public set enableWheel(val: boolean) {
		this.#enableWheel = val
	}

	public get zoom() {
		return this.#currentZoom
	}

	public set zoom(val: number) {
		this.updateTo(val)
	}

	public get pan() {
		return this.#pan
	}

	public get handlers() {
		return {
			...this.#gesture.handlers,
			Wheel: this.#handleWheel.bind(this),
			DoubleClick: this.#handleDoubleClick.bind(this),
		}
	}

	#handleDragStart() {
		this.#transitionPan.cancel()
		this.#transitionZoomPan.cancel()
		this.#startPan = clonePoint(this.#pan)
	}

	#handleDragChange() {
		if (!this.#enablePan)
			return

		const delta = this.#gesture.getDragDelta()
		this.#pan = createPoint(
			this.#pan.x + delta.x,
			this.#pan.y + delta.y,
		)
		this.#applyChanges()
	}

	#handleDragEnd() {
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

	#handleZoomStart() {
		this.#transitionPan.cancel()
		this.#transitionZoomPan.cancel()
		this.#startZoom = this.#currentZoom
		this.#startPan = clonePoint(this.#pan)
	}

	#handleZoomChange() {
		if (!this.#enablePinch)
			return

		const currentDistance = this.#gesture.getZoomDistance()
		const startDistance = this.#gesture.getStartZoomDistance()

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

			const zoomCenter = this.#gesture.getZoomCenter()
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

	#handleZoomEnd() {
		this.#correctZoomAndPan()
	}

	#handleDoubleClick(event: DoubleClickEventPayload) {
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

	#handleWheel(event: WheelEventPayload) {
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

				this.#timeoutWheel = setTimeout(() => {
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

	#animatePan(targetPan: Point, duration?: number) {
		this.#transitionPan.cancel()

		const startPan = clonePoint(this.#pan)
		const useDuration = duration ?? this.#animationDuration

		this.#transitionPan = runTransition({
			start: 0,
			end: 1,
			duration: useDuration,
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

	#createProjectPoint(velocity: Point, decelerationRate: number): Point {
		const factor = decelerationRate / (1 - decelerationRate)
		return createPoint(
			velocity.x * factor,
			velocity.y * factor,
		)
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
	#min: Point = createPoint()
	#max: Point = createPoint()
	#center: Point = createPoint() // TODO: 可以不用
	#props: {
		getContainerBoundingClientRect: () => Rect
		getElementStyleSize: () => Size
	}

	constructor(props: {
		getContainerBoundingClientRect: () => Rect
		getElementStyleSize: () => Size
	}) {
		this.#props = props
	}

	update(zoom: number) {
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

	reset() {
		this.#min = createPoint()
		this.#max = createPoint()
		this.#center = createPoint()
	}

	#updateAxis(
		axis: AxisValue,
		containerSize: Size,
		scaledSize: Size,
	) {
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

	#updateCenter() {
		this.#center = createPoint(
			(this.#min.x + this.#max.x) / 2,
			(this.#min.y + this.#max.y) / 2,
		)
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

	#numActivePoints = 0
	#intervalTime = 0
	#intervalP1: Point = createPoint()

	#lastTapTime = 0
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
	}

	get velocity() {
		return this.#velocity
	}

	getZoomDistance() {
		if (this.#numActivePoints > 1)
			return getPointDistance(this.#p1, this.#p2)
		return 0
	}

	getStartZoomDistance() {
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

	get handlers() {
		return {
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

	#handleTouchStart(event: GestureEventPayload) {
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

	#handleTouchMove(event: GestureEventPayload) {
		this.#updatePointsFromTouch(event, 'move')
		this.#onGestureChange()
	}

	#handleTouchEnd(event: GestureEventPayload) {
		this.#updatePointsFromTouch(event, 'up')
		this.#onGestureEnd()
	}

	#handleMouseDown(event: GestureEventPayload) {
		this.#updatePointsFromMouse(event, 'down')
		this.#onGestureStart()
	}

	#handleMouseMove(event: GestureEventPayload) {
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

	#handleMouseUp(event: GestureEventPayload) {
		this.#updatePointsFromMouse(event, 'up')
		this.#onGestureEnd()
	}

	#handleGlobalMouseMove(event: GestureEventPayload) {
		if (this.#numActivePoints > 0 && !this.#checkPointInContainer(event.touches[0])) {
			if (this.#isDragging) {
				this.#numActivePoints = 0
				this.#onGestureEnd()
			}
		}
	}

	#handleGlobalMouseUp(event: GestureEventPayload) {
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

	#onGestureEnd() {
		if (this.#numActivePoints === 0) {
			if (this.#isDragging) {
				this.#isDragging = false
				this.#updateVelocity()
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

	#updateVelocity(): void {
		const currentTime = Date.now()
		const duration = currentTime - this.#intervalTime
		if (duration < this.#VELOCITY_HYSTERESIS)
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
