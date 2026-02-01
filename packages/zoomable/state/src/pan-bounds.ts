import type { AxisValue, Point, Rect, Size } from '@bouzu/shared'
import { Axis, createPoint, createSize, getSizeByAxis } from '@bouzu/shared'

export class PanBounds {
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
