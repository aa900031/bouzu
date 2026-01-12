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

	#zoom: number
	#offset: Point = createPoint()
	#startZoom: number
	#startOffset: Point = createPoint()
	#timeoutWheel: any = null
	#transition: TransitionRunner = runNoopTransition()

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

		this.#zoom = this.#initial
		this.#startZoom = this.#zoom

		this.#panBounds = new PanBounds(props)
		this.#gesture = new Gesture({
			...props,
			onDragStart: this.#handleDragStart.bind(this),
			onDragChange: this.#handleDragChange.bind(this),
			onDragEnd: this.#handleDragEnd.bind(this),
			onZoomStart: this.#handleZoomStart.bind(this),
			onZoomChange: this.#handleZoomChange.bind(this),
			onZoomEnd: this.#handleZoomEnd.bind(this),
			onGestureStart: this.#handleGestureStart.bind(this),
			onDoubleTap: this.#handleDoubleClick.bind(this),
		})
	}

	on = this.#emitter.on
	off = this.#emitter.off

	public updateTo(zoom: number, focal?: Point): void {
		this.#applyZoom(zoom, { focal, animate: true })
	}

	public updateIn(step = 0.2): void {
		this.updateTo(this.#zoom + step, createPoint())
	}

	public updateOut(step = 0.2): void {
		this.updateTo(this.#zoom - step, createPoint())
	}

	public reset(): void {
		this.#animateTo(this.#initial, createPoint())
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
		return this.#zoom
	}

	public set zoom(val: number) {
		this.updateTo(val)
	}

	public get pan() {
		return this.#offset
	}

	public get handlers() {
		return {
			...this.#gesture.handlers,
			Wheel: this.#handleWheel.bind(this),
			DoubleClick: this.#handleDoubleClick.bind(this),
		}
	}

	#handleGestureStart() {
		this.#transition.cancel()
	}

	#handleDragStart() {
		this.#startOffset = clonePoint(this.#offset)
	}

	#handleDragChange() {
		if (!this.#enablePan)
			return

		const delta = this.#gesture.getDragDelta()
		this.#offset = createPoint(
			this.#offset.x + delta.x,
			this.#offset.y + delta.y,
		)
		this.#applyChanges()
	}

	#handleDragEnd() {
		if (!this.#enablePan)
			return

		const correctedOffset = this.#panBounds.getCorrectOffset(this.#offset, this.#zoom)
		const needsBoundaryCorrection
			= Math.abs(correctedOffset.x - this.#offset.x) > 0.1
				|| Math.abs(correctedOffset.y - this.#offset.y) > 0.1

		const velocity = this.#gesture.velocity
		const decelerationRate = 0.95
		const projectPoint = this.#createProjectPoint(velocity, decelerationRate)
		const projectedOffset = createPoint(
			correctedOffset.x + projectPoint.x,
			correctedOffset.y + projectPoint.y,
		)

		const finalOffset = this.#panBounds.getCorrectOffset(projectedOffset, this.#zoom)
		const needsInertiaAnimation
			= Math.abs(finalOffset.x - correctedOffset.x) > 1
				|| Math.abs(finalOffset.y - correctedOffset.y) > 1

		if (needsBoundaryCorrection || needsInertiaAnimation) {
			const target = needsInertiaAnimation ? finalOffset : correctedOffset
			this.#animateTo(this.#zoom, target)
		}
	}

	#handleZoomStart() {
		this.#startZoom = this.#zoom
		this.#startOffset = clonePoint(this.#offset)
	}

	#handleZoomChange() {
		if (!this.#enablePinch)
			return

		const currentDistance = this.#gesture.getZoomDistance()
		const startDistance = this.#gesture.getStartZoomDistance()

		if (startDistance > 0) {
			const zoomFactor = currentDistance / startDistance
			let targetZoom = this.#startZoom * zoomFactor

			const minZoomWithFriction = this.#min * 0.8
			const maxZoomWithFriction = this.#max * 1.2

			if (targetZoom < this.#min) {
				targetZoom = this.#min + (targetZoom - this.#min) * 0.3
				targetZoom = Math.max(targetZoom, minZoomWithFriction)
			}
			else if (targetZoom > this.#max) {
				targetZoom = this.#max + (targetZoom - this.#max) * 0.3
				targetZoom = Math.min(targetZoom, maxZoomWithFriction)
			}

			const focal = this.#getRelativePoint(this.#gesture.getZoomCenter())
			this.#applyZoom(targetZoom, { focal })
		}
	}

	#handleZoomEnd() {
		this.#correctBoundary()
	}

	#handleDoubleClick(event: DoubleClickEventPayload) {
		const targetZoom = this.#zoom > this.#initial ? this.#initial : this.#max
		const focal = this.#getRelativePoint(event.client)
		this.#applyZoom(targetZoom, { focal, animate: true })
	}

	#handleWheel(event: WheelEventPayload) {
		if (this.#enableWheel === false)
			return

		if (event.withCtrl) {
			const step = 0.1
			const wheel = event.delta.y > 0 ? -1 : 1
			const targetZoom = this.#zoom * Math.exp(wheel * step)
			const focal = this.#getRelativePoint(event.client)

			this.#applyZoom(targetZoom, { focal })

			if (this.#timeoutWheel)
				clearTimeout(this.#timeoutWheel)

			this.#timeoutWheel = setTimeout(() => {
				this.#correctBoundary()
				this.#timeoutWheel = null
			}, 150)
		}
		else {
			const dragSpeed = 1.0
			const newOffset = createPoint(
				this.#offset.x - event.delta.x * dragSpeed,
				this.#offset.y - event.delta.y * dragSpeed,
			)

			this.#offset = this.#panBounds.getCorrectOffset(newOffset, this.#zoom)
			this.#applyChanges()
		}
	}

	#getRelativePoint(client: Point): Point {
		const rect = this.#props.getContainerBoundingClientRect()
		return createPoint(
			client.x - rect.x - rect.width / 2,
			client.y - rect.y - rect.height / 2,
		)
	}

	#applyZoom(zoom: number, options: { focal?: Point, animate?: boolean } = {}) {
		const targetZoom = clamp(zoom, this.#min * 0.8, this.#max * 1.2)
		const focal = options.focal ?? createPoint()

		// Formula: T_new = F - (F - T_old) * (z_new / z_old)
		const zoomFactor = targetZoom / this.#zoom
		const targetOffset = createPoint(
			focal.x - (focal.x - this.#offset.x) * zoomFactor,
			focal.y - (focal.y - this.#offset.y) * zoomFactor,
		)

		if (options.animate) {
			this.#animateTo(targetZoom, targetOffset)
		}
		else {
			this.#zoom = targetZoom
			this.#offset = targetOffset
			this.#applyChanges()
		}
	}

	#applyChanges() {
		this.#emitter.emit(ZoomableEventName.ChangeZoom, this.#zoom)
		this.#emitter.emit(ZoomableEventName.ChangePan, this.#offset)
	}

	#createProjectPoint(velocity: Point, decelerationRate: number): Point {
		const factor = decelerationRate / (1 - decelerationRate)
		return createPoint(
			velocity.x * factor,
			velocity.y * factor,
		)
	}

	#animateTo(targetZoom: number, targetOffset: Point) {
		this.#transition.cancel()

		const startZoom = this.#zoom
		const startOffset = clonePoint(this.#offset)

		const clampedZoom = clamp(targetZoom, this.#min, this.#max)
		const finalOffset = this.#panBounds.getCorrectOffset(targetOffset, clampedZoom)

		this.#transition = runTransition({
			start: 0,
			end: 1,
			duration: this.#animationDuration,
			easing: easeOutCubic,
			onUpdate: (progress) => {
				this.#offset = createPoint(
					startOffset.x + (finalOffset.x - startOffset.x) * progress,
					startOffset.y + (finalOffset.y - startOffset.y) * progress,
				)
				this.#zoom = startZoom + (clampedZoom - startZoom) * progress
				this.#applyChanges()
			},
		})
	}

	#correctBoundary() {
		const targetZoom = clamp(this.#zoom, this.#min, this.#max)
		const targetOffset = this.#panBounds.getCorrectOffset(this.#offset, targetZoom)

		const needsCorrection
			= Math.abs(targetZoom - this.#zoom) > 0.001
				|| Math.abs(targetOffset.x - this.#offset.x) > 0.1
				|| Math.abs(targetOffset.y - this.#offset.y) > 0.1

		if (needsCorrection)
			this.#animateTo(targetZoom, targetOffset)
	}
}

class PanBounds {
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

	getCorrectOffset(offset: Point, zoom: number): Point {
		const containerRect = this.#props.getContainerBoundingClientRect()
		const contentSize = this.#props.getElementStyleSize()

		const scaledWidth = contentSize.width * zoom
		const scaledHeight = contentSize.height * zoom

		return createPoint(
			this.#getCorrectAxisOffset(offset.x, scaledWidth, containerRect.width),
			this.#getCorrectAxisOffset(offset.y, scaledHeight, containerRect.height),
		)
	}

	#getCorrectAxisOffset(offset: number, scaledSize: number, containerSize: number): number {
		if (scaledSize <= containerSize)
			return 0

		const overflow = (scaledSize - containerSize) / 2
		return clamp(offset, -overflow, overflow)
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
		onGestureStart: () => void
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
		onGestureStart: () => void
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
			const currentPosition = createPoint(
				touch.client.x,
				touch.client.y,
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
		this.#props.onGestureStart?.()
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

			if (this.#isDragging) {
				this.#props.onDragChange?.()
				this.#updatePrevPoints()
			}
		}

		if (this.#numActivePoints > 1) {
			if (!this.#isZooming) {
				this.#isZooming = true
				this.#props.onZoomStart?.()
			}

			if (this.#isZooming) {
				this.#props.onZoomChange?.()
				this.#updatePrevPoints()
			}
		}

		const now = Date.now()
		if (now - this.#intervalTime > this.#VELOCITY_HYSTERESIS) {
			this.#velocity = createPoint(
				(this.#p1.x - this.#intervalP1.x) / (now - this.#intervalTime) * 16.6,
				(this.#p1.y - this.#intervalP1.y) / (now - this.#intervalTime) * 16.6,
			)
			this.#intervalTime = now
			this.#intervalP1 = clonePoint(this.#p1)
		}
	}

	#onGestureEnd() {
		if (this.#isDragging) {
			this.#isDragging = false
			this.#props.onDragEnd?.()
		}

		if (this.#isZooming) {
			this.#isZooming = false
			this.#props.onZoomEnd?.()
		}

		this.#dragAxis = null
	}

	#updatePrevPoints() {
		this.#prevP1 = clonePoint(this.#p1)
		this.#prevP2 = clonePoint(this.#p2)
	}

	#getTouchPoint(touch: { client: Point }): Point {
		return clonePoint(touch.client)
	}

	#checkPointInContainer(touch: { client: Point }): boolean {
		if (!touch)
			return false
		const rect = this.#props.getContainerBoundingClientRect()
		return checkRectContainsPoint(rect, touch.client)
	}
}
