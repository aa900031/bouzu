import type { Point, Rect, RegisterRafMethods, Size, TransitionRunner } from '@bouzu/shared'
import type { Emitter } from 'mitt'
import type { DoubleClickEventPayload, GestureHandlers } from './gesture'
import { checkPointEqualWithTolerance, clamp, clonePoint, createPoint, easeOutCubic, runNoopTransition, runTransition } from '@bouzu/shared'
import mitt from 'mitt'
import { Gesture } from './gesture'
import { PanBounds } from './pan-bounds'

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
		this.#panBounds = new PanBounds({
			getContainerBoundingClientRect: this.#props.getContainerBoundingClientRect,
			getElementStyleSize: this.#props.getElementStyleSize,
		})
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

	public destroy() {
		this.#emitter.all.clear()
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
