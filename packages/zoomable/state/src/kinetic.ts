import type { CancelRaf, Point, RegisterRafMethods } from '@bouzu/shared'
import { createPoint, registerRaf } from '@bouzu/shared'

export interface KineticProps {
	getPoint: () => Point
	getBounds: (point: Point) => Point
	onUpdate: (point: Point) => void
	onFinished?: () => void
	minVelocity?: number
	amplitude?: number
	timeConstant?: number
	springStiffness?: number
	springDamping?: number
	springRestThreshold?: number
	rafFn?: RegisterRafMethods['raf']
	cafFn?: RegisterRafMethods['caf']
}

const DEFAULT_TIME_CONSTANT = 342
const DEFAULT_MIN_VELOCITY = 5
const DEFAULT_AMPLITUDE = 0.25
const DEFAULT_SPRING_STIFFNESS = 400
const DEFAULT_SPRING_DAMPING = 30
const DEFAULT_SPRING_REST_THRESHOLD = 0.5

export class Kinetic {
	#props: KineticProps

	#lastPoint: Point = createPoint()
	#timestamp: number = 0

	#ticker: CancelRaf | null = null
	#animation: CancelRaf | null = null
	#lastFrameTime: number = 0

	#vx: number = 0
	#vy: number = 0

	// current position during animation
	#x: number = 0
	#y: number = 0

	// velocity during animation (px/s)
	#animVx: number = 0
	#animVy: number = 0

	#releasedOutOfBounds: boolean = false

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

	get #springStiffness() {
		return this.#props.springStiffness ?? DEFAULT_SPRING_STIFFNESS
	}

	get #springDamping() {
		return this.#props.springDamping ?? DEFAULT_SPRING_DAMPING
	}

	get #springRestThreshold() {
		return this.#props.springRestThreshold ?? DEFAULT_SPRING_REST_THRESHOLD
	}

	start() {
		this.#lastPoint = this.#props.getPoint()
		this.#vx = this.#vy = 0
		this.#timestamp = Date.now()

		this.cancel()
		this.#ticker = registerRaf(this.#track, { raf: this.#props.rafFn, caf: this.#props.cafFn })
	}

	stop() {
		this.cancel()

		const currentPoint = this.#props.getPoint()
		this.#x = currentPoint.x
		this.#y = currentPoint.y

		this.#animVx = Math.abs(this.#vx) > this.#minVelocity ? this.#vx * this.#amplitude * 1000 / this.#timeConstant : 0
		this.#animVy = Math.abs(this.#vy) > this.#minVelocity ? this.#vy * this.#amplitude * 1000 / this.#timeConstant : 0

		const bounded = this.#props.getBounds(currentPoint)
		this.#releasedOutOfBounds = bounded.x !== currentPoint.x || bounded.y !== currentPoint.y
		const hasVelocity = this.#animVx !== 0 || this.#animVy !== 0

		if (hasVelocity || this.#releasedOutOfBounds) {
			this.#lastFrameTime = Date.now()
			this.#animation = registerRaf(this.#animate, { raf: this.#props.rafFn, caf: this.#props.cafFn })
		}
		else {
			this.#props.onFinished?.()
		}
	}

	cancel() {
		this.#ticker?.()
		this.#animation?.()
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

	#animate = () => {
		const now = Date.now()
		const dt = Math.min((now - this.#lastFrameTime) / 1000, 0.064) // cap at ~16fps min
		this.#lastFrameTime = now

		if (this.#releasedOutOfBounds) {
			this.#animateSpring(dt)
		}
		else {
			this.#animateInertia(dt)
		}
	}

	#animateInertia(dt: number) {
		const friction = Math.exp(-dt * 1000 / this.#timeConstant)

		this.#animVx *= friction
		this.#animVy *= friction
		this.#x += this.#animVx * dt
		this.#y += this.#animVy * dt

		const bounded = this.#props.getBounds(createPoint(this.#x, this.#y))
		this.#x = bounded.x
		this.#y = bounded.y

		const speed = Math.sqrt(this.#animVx ** 2 + this.#animVy ** 2)

		if (speed < this.#springRestThreshold) {
			this.#props.onUpdate(bounded)
			this.#props.onFinished?.()
		}
		else {
			this.#props.onUpdate(createPoint(this.#x, this.#y))
			this.#animation = registerRaf(this.#animate, { raf: this.#props.rafFn, caf: this.#props.cafFn })
		}
	}

	#animateSpring(dt: number) {
		const stiffness = this.#springStiffness
		const damping = this.#springDamping
		const bounded = this.#props.getBounds(createPoint(this.#x, this.#y))

		const overshootX = this.#x - bounded.x
		const springAx = -stiffness * overshootX - damping * this.#animVx
		this.#animVx += springAx * dt
		this.#x += this.#animVx * dt

		const overshootY = this.#y - bounded.y
		const springAy = -stiffness * overshootY - damping * this.#animVy
		this.#animVy += springAy * dt
		this.#y += this.#animVy * dt

		const speed = Math.sqrt(this.#animVx ** 2 + this.#animVy ** 2)
		const newBounded = this.#props.getBounds(createPoint(this.#x, this.#y))
		const totalOvershoot = Math.abs(this.#x - newBounded.x) + Math.abs(this.#y - newBounded.y)
		const atRest = speed < this.#springRestThreshold && totalOvershoot < this.#springRestThreshold

		if (atRest) {
			this.#props.onUpdate(newBounded)
			this.#props.onFinished?.()
		}
		else {
			this.#props.onUpdate(createPoint(this.#x, this.#y))
			this.#animation = registerRaf(this.#animate, { raf: this.#props.rafFn, caf: this.#props.cafFn })
		}
	}
}
