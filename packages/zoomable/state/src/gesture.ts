import type { AxisValue, Point, Rect } from '@bouzu/shared'
import { Axis, checkPointEqualWithTolerance, checkRectContainsPoint, clonePoint, createPoint, getPointCenter, getPointDistance } from '@bouzu/shared'

export interface GestureEventPayload {
	touches: {
		client: Point
	}[]
}

export interface DoubleClickEventPayload {
	client: Point
}

export interface GestureHandlers {
	TouchStart: (event: GestureEventPayload) => void
	TouchMove: (event: GestureEventPayload) => void
	TouchEnd: (event: GestureEventPayload) => void
	MouseDown: (event: GestureEventPayload) => void
	MouseMove: (event: GestureEventPayload) => void
	MouseUp: (event: GestureEventPayload) => void
	GlobalMouseMove: (event: GestureEventPayload) => void
	GlobalMouseUp: (event: GestureEventPayload) => void
}

export class Gesture {
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
