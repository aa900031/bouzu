import type { CancelRaf, Point, RegisterRafMethods } from '@bouzu/shared'
import { createPoint, registerRaf } from '@bouzu/shared'

export interface KineticProps {
	getPoint: () => Point
	scroll: (x: number, y: number) => void
	onComplete: () => void
	getBounds: (point: Point) => Point
	minVelocity?: number
	amplitude?: number
	timeConstant?: number
	rafFn?: RegisterRafMethods['raf']
	cafFn?: RegisterRafMethods['caf']
}

/**
 * Kinetic scrolling implementation based on panzoom's kinetic.js
 * Uses exponential decay for natural physics-based inertia
 */
export class Kinetic {
	#getPoint: () => Point
	#scroll: (x: number, y: number) => void
	#onComplete: () => void
	#getBounds: (point: Point) => Point

	#rafFn: RegisterRafMethods['raf']
	#cafFn: RegisterRafMethods['caf']

	#minVelocity: number
	#amplitude: number
	#timeConstant: number

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
		this.#getPoint = props.getPoint
		this.#scroll = props.scroll
		this.#onComplete = props.onComplete
		this.#getBounds = props.getBounds
		this.#rafFn = props.rafFn
		this.#cafFn = props.cafFn

		this.#minVelocity = props.minVelocity ?? 5
		this.#amplitude = props.amplitude ?? 0.25
		this.#timeConstant = props.timeConstant ?? 342
	}

	start() {
		this.#lastPoint = this.#getPoint()
		this.#ax = this.#ay = this.#vx = this.#vy = 0
		this.#timestamp = Date.now()

		this.cancel()
		this.#ticker = registerRaf(this.#track, { raf: this.#rafFn, caf: this.#cafFn })
	}

	stop() {
		this.cancel()

		const currentPoint = this.#getPoint()
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

		// Apply bounds to target position
		const boundedTarget = this.#getBounds(createPoint(this.#targetX, this.#targetY))
		this.#targetX = boundedTarget.x
		this.#targetY = boundedTarget.y

		// Only start auto-scroll if there's actual velocity
		if (this.#ax !== 0 || this.#ay !== 0) {
			this.#scroller = registerRaf(this.#autoScroll, { raf: this.#rafFn, caf: this.#cafFn })
		}
		else {
			// If no velocity, still check if we need boundary correction
			const currentPos = this.#getPoint()
			const bounded = this.#getBounds(currentPos)
			if (Math.abs(bounded.x - currentPos.x) > 0.1 || Math.abs(bounded.y - currentPos.y) > 0.1) {
				this.#onComplete()
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

		const currentPoint = this.#getPoint()
		const dx = currentPoint.x - this.#lastPoint.x
		const dy = currentPoint.y - this.#lastPoint.y
		this.#lastPoint = currentPoint

		const dt = 1000 / (1 + elapsed)

		// Moving average for smooth velocity calculation
		this.#vx = 0.8 * dx * dt + 0.2 * this.#vx
		this.#vy = 0.8 * dy * dt + 0.2 * this.#vy

		this.#ticker = registerRaf(this.#track, { raf: this.#rafFn, caf: this.#cafFn })
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
			this.#scroll(this.#targetX + dx, this.#targetY + dy)
			this.#scroller = registerRaf(this.#autoScroll, { raf: this.#rafFn, caf: this.#cafFn })
		}
		else {
			// Animation complete, ensure we're at the bounded position
			this.#scroll(this.#targetX, this.#targetY)
			this.#onComplete()
		}
	}
}
