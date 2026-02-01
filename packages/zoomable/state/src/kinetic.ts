import type { CancelRaf, Point, RegisterRafMethods } from '@bouzu/shared'
import { createPoint, registerRaf } from '@bouzu/shared'

export interface KineticProps {
	getPoint: () => Point
	onScroll: (x: number, y: number) => void
	onComplete: () => void
	getBounds: (point: Point) => Point
	minVelocity?: number
	amplitude?: number
	timeConstant?: number
	rafFn?: RegisterRafMethods['raf']
	cafFn?: RegisterRafMethods['caf']
}

const DEFAULT_TIME_CONSTANT = 342
const DEFAULT_MIN_VELOCITY = 5
const DEFAULT_AMPLITUDE = 0.25

export class Kinetic {
	#props: KineticProps

	#lastPoint: Point = createPoint()
	#timestamp: number = 0

	#ticker: CancelRaf | null = null
	#scroller: CancelRaf | null = null

	#vx: number = 0
	#vy: number = 0
	#ax: number = 0
	#ay: number = 0
	#targetX: number = 0
	#targetY: number = 0

	constructor(props: KineticProps) {
		this.#props = props
	}

	get #minVelocity() {
		return this.#props.minVelocity ?? DEFAULT_MIN_VELOCITY
	}

	get #amplitude() {
		return this.#props.amplitude ?? DEFAULT_AMPLITUDE
	}

	get #timeConstant() {
		return this.#props.timeConstant ?? DEFAULT_TIME_CONSTANT
	}

	start() {
		this.#lastPoint = this.#props.getPoint()
		this.#ax = this.#ay = this.#vx = this.#vy = 0
		this.#timestamp = Date.now()

		this.cancel()
		this.#ticker = registerRaf(this.#track, { raf: this.#props.rafFn, caf: this.#props.cafFn })
	}

	stop() {
		this.cancel()

		const currentPoint = this.#props.getPoint()
		this.#targetX = currentPoint.x
		this.#targetY = currentPoint.y
		this.#timestamp = Date.now()

		if (this.#vx < -this.#minVelocity || this.#vx > this.#minVelocity) {
			this.#ax = this.#amplitude * this.#vx
			this.#targetX += this.#ax
		}

		if (this.#vy < -this.#minVelocity || this.#vy > this.#minVelocity) {
			this.#ay = this.#amplitude * this.#vy
			this.#targetY += this.#ay
		}

		const boundedTarget = this.#props.getBounds(createPoint(this.#targetX, this.#targetY))
		this.#targetX = boundedTarget.x
		this.#targetY = boundedTarget.y

		if (this.#ax !== 0 || this.#ay !== 0) {
			this.#scroller = registerRaf(this.#autoScroll, { raf: this.#props.rafFn, caf: this.#props.cafFn })
		}
		else {
			const currentPos = this.#props.getPoint()
			const bounded = this.#props.getBounds(currentPos)
			if (Math.abs(bounded.x - currentPos.x) > 0.1 || Math.abs(bounded.y - currentPos.y) > 0.1) {
				this.#props.onComplete()
			}
		}
	}

	cancel() {
		this.#ticker?.()
		this.#scroller?.()
	}

	#track = () => {
		const now = Date.now()
		const elapsed = now - this.#timestamp
		this.#timestamp = now

		const currentPoint = this.#props.getPoint()
		const dx = currentPoint.x - this.#lastPoint.x
		const dy = currentPoint.y - this.#lastPoint.y
		this.#lastPoint = currentPoint

		const dt = 1000 / (1 + elapsed)

		this.#vx = 0.8 * dx * dt + 0.2 * this.#vx
		this.#vy = 0.8 * dy * dt + 0.2 * this.#vy

		this.#ticker = registerRaf(this.#track, { raf: this.#props.rafFn, caf: this.#props.cafFn })
	}

	#autoScroll = () => {
		const elapsed = Date.now() - this.#timestamp
		let moving = false
		let dx = 0
		let dy = 0

		if (this.#ax) {
			dx = -this.#ax * Math.exp(-elapsed / this.#timeConstant)
			if (dx > 0.5 || dx < -0.5) {
				moving = true
			}
			else {
				dx = this.#ax = 0
			}
		}

		if (this.#ay) {
			dy = -this.#ay * Math.exp(-elapsed / this.#timeConstant)
			if (dy > 0.5 || dy < -0.5) {
				moving = true
			}
			else {
				dy = this.#ay = 0
			}
		}

		if (moving) {
			this.#props.onScroll(this.#targetX + dx, this.#targetY + dy)
			this.#scroller = registerRaf(this.#autoScroll, { raf: this.#props.rafFn, caf: this.#props.cafFn })
		}
		else {
			this.#props.onScroll(this.#targetX, this.#targetY)
			this.#props.onComplete()
		}
	}
}
