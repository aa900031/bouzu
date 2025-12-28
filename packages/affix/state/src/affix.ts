import type { AxisValue, Point, Rect, Size } from '@bouzu/shared'
import { Axis, checkPointEqual, createPointByAxis, createRect, createSize, getPointByAxis, getRectMaxByAxis, getSizeByAxis } from '@bouzu/shared'
import mitt from 'mitt'

export const AffixEvent = {
	ChangeFixed: 'change-fixed',
	ChangeDifference: 'change-difference',
} as const

export const AffixAlign = {
	Start: 'start',
	End: 'end',
} as const

export type AffixAlignValues = typeof AffixAlign[keyof typeof AffixAlign]

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[AffixEvent.ChangeFixed]: {
		value: boolean
	}
	[AffixEvent.ChangeDifference]: {
		value: Point | undefined
	}
}

export interface AffixOptions {
	align?: AffixAlignValues
	axis?: AxisValue
}

export class Affix {
	#emitter = mitt<Events>()
	#align: AffixAlignValues
	#axis: AxisValue
	#disabled: boolean

	#fixed: boolean
	#difference: Point | undefined

	#windowSize: Size
	#targetBoundingRect: Rect
	#containerBoundingRect: Rect | undefined

	on = this.#emitter.on
	off = this.#emitter.off

	constructor(
		props?: AffixOptions,
	) {
		this.#disabled = false
		this.#align = props?.align ?? AffixAlign.Start
		this.#axis = props?.axis ?? Axis.Y

		this.#fixed = false
		this.#difference = undefined
		this.#windowSize = createSize()
		this.#targetBoundingRect = createRect()
		this.#containerBoundingRect = undefined
	}

	public get align(): AffixAlignValues {
		return this.#align
	}

	public set align(val: AffixAlignValues) {
		this.#align = val
		this.update()
	}

	public get axis(): AxisValue {
		return this.#axis
	}

	public set axis(v: AxisValue) {
		this.#axis = v
		this.update()
	}

	public get fixed(): boolean {
		return this.#fixed
	}

	public set fixed(val: boolean) {
		this.#updateFixed(val)
	}

	public get difference(): Point | undefined {
		return this.#difference
	}

	public get targetBoundingRect(): Rect {
		return this.#targetBoundingRect
	}

	public set targetBoundingRect(v: Rect) {
		this.#targetBoundingRect = v
		this.update()
	}

	public get containerBoundingRect(): Rect | undefined {
		return this.#containerBoundingRect
	}

	public set containerBoundingRect(v: Rect | undefined) {
		this.#containerBoundingRect = v
		this.update()
	}

	public get windowSize(): Size {
		return this.#windowSize
	}

	public set windowSize(v: Size) {
		this.#windowSize = v
		this.update()
	}

	public get disabled(): boolean {
		return this.#disabled
	}

	public set disabled(
		value: boolean,
	) {
		this.#disabled = value
	}

	public update(
		force = false,
	) {
		if (!force && this.#disabled)
			return

		switch (this.#align) {
			case AffixAlign.Start: {
				if (this.#containerBoundingRect) {
					this.#updateFixed(
						getPointByAxis(this.#targetBoundingRect, this.#axis) < 0
						&& getRectMaxByAxis(this.#containerBoundingRect, this.#axis) > 0,
					)

					const difference = getRectMaxByAxis(this.#containerBoundingRect, this.#axis) - getSizeByAxis(this.#targetBoundingRect, this.#axis)
					this.#updateDifference(
						createPointByAxis(difference < 0 ? difference : 0, this.#axis),
					)
				}
				else {
					this.#updateFixed(
						getPointByAxis(this.#targetBoundingRect, this.#axis) < 0,
					)
					this.#updateDifference(undefined)
				}
				break
			}
			case AffixAlign.End: {
				if (this.#containerBoundingRect) {
					this.#updateFixed(
						getSizeByAxis(this.#windowSize, this.#axis) < getRectMaxByAxis(this.#targetBoundingRect, this.#axis)
						&& getSizeByAxis(this.#windowSize, this.#axis) > getPointByAxis(this.#containerBoundingRect, this.#axis),
					)
					const difference = getSizeByAxis(this.#windowSize, this.#axis) - getPointByAxis(this.#containerBoundingRect, this.#axis) - getSizeByAxis(this.#targetBoundingRect, this.#axis)
					this.#updateDifference(
						createPointByAxis(difference < 0 ? -difference : 0, this.#axis),
					)
				}
				else {
					this.#updateFixed(
						getSizeByAxis(this.#windowSize, this.#axis) < getRectMaxByAxis(this.#targetBoundingRect, this.#axis),
					)
					this.#updateDifference(undefined)
				}
				break
			}
		}
	}

	public destroy() {
		this.#emitter.all.clear()
	}

	#updateFixed(val: boolean) {
		if (val === this.#fixed)
			return

		this.#fixed = val
		this.#emitter.emit(AffixEvent.ChangeFixed, {
			value: this.#fixed,
		})
	}

	#updateDifference(
		val: Point | undefined,
	) {
		if (
			(val === undefined && this.#difference === undefined)
			|| (val !== undefined && this.#difference !== undefined && checkPointEqual(val, this.#difference))
		) {
			return
		}

		this.#difference = val
		this.#emitter.emit(AffixEvent.ChangeDifference, {
			value: this.#difference,
		})
	}
}
