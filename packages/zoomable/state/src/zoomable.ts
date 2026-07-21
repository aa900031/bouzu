import type { Point, Rect, RegisterRafMethods, Size, TransitionRunner } from '@bouzu/shared'
import type { Emitter } from 'mitt'
import type { DoubleClickEventPayload, GestureHandlers } from './gesture'
import { checkPointEqualWithTolerance, clamp, clonePoint, createPoint, runNoopTransition, runTransition } from '@bouzu/shared'
import mitt from 'mitt'
import { Gesture } from './gesture'
import { Kinetic } from './kinetic'
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
	ChangeIsPaning: 'change-is-paning',
	ChangeIsZooming: 'change-is-zooming',
	PanStart: 'pan-start',
	PanEnd: 'pan-end',
	ZoomStart: 'zoom-start',
	ZoomEnd: 'zoom-end',
} as const

// eslint-disable-next-line ts/consistent-type-definitions
export type ZoomableEvents = {
	[ZoomableEventName.ChangePan]: Point
	[ZoomableEventName.ChangeZoom]: number
	[ZoomableEventName.ChangeIsPaning]: boolean
	[ZoomableEventName.ChangeIsZooming]: boolean
	[ZoomableEventName.PanStart]: void
	[ZoomableEventName.PanEnd]: void
	[ZoomableEventName.ZoomStart]: void
	[ZoomableEventName.ZoomEnd]: void
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
	#kinetic: Kinetic

	#min: number
	#max: number
	#initial: number
	#animationDuration: number
	#enablePan: boolean
	#enablePinch: boolean
	#enableWheel: boolean
	#isPaning: boolean
	#isZooming: boolean

	#currentZoom: number
	#pan: Point
	#startZoom: number
	#startPan: Point
	#timeoutPanWheel: number | null
	#timeoutZoomWheel: number | null
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
		this.#kinetic = new Kinetic({
			getPoint: () => clonePoint(this.#pan),
			getBounds: point => this.#panBounds.getCorrectPan(point),
			onUpdate: (point) => {
				this.#pan = point
				this.#applyChanges()
			},
			rafFn: this.#props.rafFn,
			cafFn: this.#props.cafFn,
		})

		this.#min = props.min ?? 0.5
		this.#max = props.max ?? 3
		this.#initial = props.initial ?? 1
		this.#animationDuration = props.animationDuration ?? 300
		this.#enablePan = props.enablePan ?? true
		this.#enablePinch = props.enablePinch ?? true
		this.#enableWheel = props.enableWheel ?? true
		this.#isPaning = false
		this.#isZooming = false

		this.#currentZoom = this.#initial
		this.#pan = createPoint()
		this.#startZoom = this.#currentZoom
		this.#startPan = createPoint()
		this.#timeoutPanWheel = null
		this.#timeoutZoomWheel = null
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
		this.#kinetic.cancel()
		this.#transitionZoomPan.cancel()
		globalThis.clearTimeout(this.#timeoutPanWheel ?? undefined)
		globalThis.clearTimeout(this.#timeoutZoomWheel ?? undefined)
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

	get isPaning() {
		return this.#isPaning
	}

	get isZooming() {
		return this.#isZooming
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

		if (!val) {
			this.#kinetic.cancel()
			globalThis.clearTimeout(this.#timeoutPanWheel ?? undefined)
			this.#timeoutPanWheel = null
			this.#updateIsPaning(false)
		}
	}

	get enablePinch() {
		return this.#enablePinch
	}

	set enablePinch(val: boolean) {
		this.#enablePinch = val

		if (!val) {
			globalThis.clearTimeout(this.#timeoutZoomWheel ?? undefined)
			this.#timeoutZoomWheel = null
			this.#updateIsZooming(false)
		}
	}

	get enableWheel() {
		return this.#enableWheel
	}

	set enableWheel(val: boolean) {
		this.#enableWheel = val

		if (!val) {
			if (this.#timeoutPanWheel) {
				globalThis.clearTimeout(this.#timeoutPanWheel)
				this.#timeoutPanWheel = null
				this.#updateIsPaning(false)
			}

			if (this.#timeoutZoomWheel) {
				globalThis.clearTimeout(this.#timeoutZoomWheel)
				this.#timeoutZoomWheel = null
				this.#updateIsZooming(false)
			}
		}
	}

	#handleDragStart = () => {
		this.#kinetic.cancel()
		this.#transitionZoomPan.cancel()

		this.#startPan = clonePoint(this.#pan)
		this.#kinetic.start()

		if (this.#enablePan)
			this.#updateIsPaning(true)
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
		if (!this.#isPaning)
			return

		if (this.#enablePan)
			this.#kinetic.stop()
		else
			this.#kinetic.cancel()

		this.#updateIsPaning(false)
	}

	#handleZoomStart = () => {
		this.#kinetic.cancel()
		this.#transitionZoomPan.cancel()

		this.#startZoom = this.#currentZoom
		this.#startPan = clonePoint(this.#pan)

		if (this.#enablePinch)
			this.#updateIsZooming(true)
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
			const startZoomCenter = this.#gesture.startZoomCenter
			const containerRect = this.#props.getContainerBoundingClientRect()
			const centerX = containerRect.width / 2
			const centerY = containerRect.height / 2

			const relativeCenterX = zoomCenter.x - centerX
			const relativeCenterY = zoomCenter.y - centerY
			const relativeStartCenterX = startZoomCenter.x - centerX
			const relativeStartCenterY = startZoomCenter.y - centerY

			const actualZoomFactor = newZoom / this.#startZoom
			const newPan = {
				x: relativeCenterX - (relativeStartCenterX - this.#startPan.x) * actualZoomFactor,
				y: relativeCenterY - (relativeStartCenterY - this.#startPan.y) * actualZoomFactor,
			}

			this.#currentZoom = newZoom
			this.#pan = newPan

			this.#panBounds.update(this.#currentZoom)
			this.#applyChanges()
		}
	}

	#handleZoomEnd = () => {
		if (!this.#isZooming)
			return

		this.#correctZoomAndPan()
		this.#updateIsZooming(false)
	}

	#handleDoubleClick = (
		event: DoubleClickEventPayload,
	) => {
		const rect = this.#props.getContainerBoundingClientRect()
		const centerX = rect.width / 2
		const centerY = rect.height / 2
		const rel = createPoint(
			event.client.x - rect.x - centerX,
			event.client.y - rect.y - centerY,
		)
		const targetZoom = this.#currentZoom > this.#initial ? this.#initial : this.#max
		this.updateTo(targetZoom, rel)
	}

	#handleWheel = (event: WheelEventPayload) => {
		if (this.#enableWheel === false)
			return

		this.#kinetic.cancel()

		if (event.withCtrl) {
			this.#updateIsZooming(true)
			const delta = event.delta.y > 0 ? -0.1 : 0.1
			const newZoom = clamp(this.#currentZoom + delta, this.#min, this.#max)

			if (newZoom !== this.#currentZoom) {
				const rect = this.#props.getContainerBoundingClientRect()
				const centerX = rect.width / 2
				const centerY = rect.height / 2

				const zoomCenter = createPoint(
					event.client.x - rect.x - centerX,
					event.client.y - rect.y - centerY,
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
			}

			globalThis.clearTimeout(this.#timeoutZoomWheel ?? undefined)
			this.#timeoutZoomWheel = globalThis.setTimeout(() => {
				this.#correctZoomAndPan()
				this.#updateIsZooming(false)
				this.#timeoutZoomWheel = null
			}, 150)
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
			const correctedPan = this.#panBounds.getCorrectPan(newPan)

			if (checkPointEqualWithTolerance(correctedPan, this.#pan)) {
				globalThis.clearTimeout(this.#timeoutPanWheel ?? undefined)
				this.#timeoutPanWheel = null
				this.#updateIsPaning(false)
				return
			}

			this.#updateIsPaning(true)
			this.#pan = correctedPan
			this.#applyChanges()

			globalThis.clearTimeout(this.#timeoutPanWheel ?? undefined)
			this.#timeoutPanWheel = globalThis.setTimeout(() => {
				this.#updateIsPaning(false)
				this.#timeoutPanWheel = null
			}, 150)
		}
	}

	#updateIsPaning(value: boolean) {
		if (this.#isPaning === value)
			return

		this.#isPaning = value
		this.#emitter.emit(ZoomableEventName.ChangeIsPaning, value)
		this.#emitter.emit(value ? ZoomableEventName.PanStart : ZoomableEventName.PanEnd)
	}

	#updateIsZooming(value: boolean) {
		if (this.#isZooming === value)
			return

		this.#isZooming = value
		this.#emitter.emit(ZoomableEventName.ChangeIsZooming, value)
		this.#emitter.emit(value ? ZoomableEventName.ZoomStart : ZoomableEventName.ZoomEnd)
	}

	#applyChanges() {
		this.#emitter.emit(ZoomableEventName.ChangeZoom, this.#currentZoom)
		this.#emitter.emit(ZoomableEventName.ChangePan, this.#pan)
	}

	#animateZoomAndPan(
		targetZoom: number,
		targetPan: Point,
	) {
		this.#kinetic.cancel()
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
