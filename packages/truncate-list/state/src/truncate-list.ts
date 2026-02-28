import type { AxisValue, Size } from '@bouzu/shared'
import type { TruncateCollapseDirectionValues } from './truncate-collapse-direction'
import { Axis, checkSizeEqual, getSizeByAxis } from '@bouzu/shared'
import mitt from 'mitt'
import { TruncateCollapseDirection } from './truncate-collapse-direction'

export const TruncateListEvent = {
	ChangeVisibleItems: 'change-visible-items',
	ChangeOverflowItems: 'change-overflow-items',
} as const

export interface TruncateListOptions {
	axis?: AxisValue
	minVisibleCount?: number
	collapseDirection?: TruncateCollapseDirectionValues
}

// eslint-disable-next-line ts/consistent-type-definitions
type Events<T> = {
	[TruncateListEvent.ChangeVisibleItems]: {
		value: T[]
	}
	[TruncateListEvent.ChangeOverflowItems]: {
		value: T[]
	}
}

const MEASURE_SIZE = 0.8

export class TruncateList<T> {
	#emitter = mitt<Events<T>>()
	on = this.#emitter.on
	off = this.#emitter.off

	minVisibleCount: NonNullable<TruncateListOptions['minVisibleCount']>
	collapseDirection: NonNullable<TruncateListOptions['collapseDirection']>
	#axis: NonNullable<TruncateListOptions['axis']>

	#items: T[] = []
	#visibleItems: T[] = []
	#overflowItems: T[] = []
	#containerSize: Size | undefined = undefined
	#measureSize: Size | undefined = undefined
	#calc: { left: number, right: number, mid: number } | undefined

	constructor(
		props?: TruncateListOptions,
	) {
		this.#axis = Axis.X
		this.minVisibleCount = props?.minVisibleCount ?? 0
		this.collapseDirection = props?.collapseDirection ?? TruncateCollapseDirection.End
	}

	get items() {
		return this.#items
	}

	set items(value: T[]) {
		this.#items = value
		this.#calc = undefined
		this.trigger()
	}

	get containerSize() {
		return this.#containerSize
	}

	set containerSize(value) {
		if (this.#containerSize && value && checkSizeEqual(this.#containerSize, value))
			return

		this.#containerSize = value
		this.#calc = undefined
		this.trigger()
	}

	get measureSize() {
		return this.#measureSize
	}

	set measureSize(value) {
		this.#measureSize = value
		if (this.#calc) {
			this.trigger()
		}
	}

	get axis() {
		return this.#axis
	}

	set axis(value) {
		if (this.#axis === value)
			return

		this.#axis = value
		this.#calc = undefined
		this.trigger()
	}

	get visibleItems() {
		return this.#visibleItems
	}

	get overflowItems() {
		return this.#overflowItems
	}

	public trigger() {
		if (this.containerSize == null)
			return

		if (this.#calc == null) {
			this.#calc = {
				left: this.minVisibleCount,
				right: this.items.length,
				mid: 0,
			}
		}
		else if (this.measureSize) {
			const measureValue = getSizeByAxis(this.measureSize, this.axis)
			if (measureValue >= MEASURE_SIZE) {
				this.#calc.left = this.#calc.mid
			}
			else {
				this.#calc.right = this.#calc.mid - 1
			}
		}

		if (this.#calc.left < this.#calc.right) {
			this.#calc.mid = Math.ceil((this.#calc.left + this.#calc.right) / 2)
			this.#updateItems(this.#calc.mid)
		}
		else {
			this.#updateItems(this.#calc.left)
			this.#calc = undefined
		}
	}

	#updateItems(count: number) {
		switch (this.collapseDirection) {
			case TruncateCollapseDirection.Start:
				this.#visibleItems = this.items.slice(this.items.length - count + 1)
				this.#overflowItems = this.items.slice(0, this.items.length - count + 1)
				break
			case TruncateCollapseDirection.End:
				this.#visibleItems = this.items.slice(0, count)
				this.#overflowItems = this.items.slice(count)
				break
		}

		this.#emitter.emit(TruncateListEvent.ChangeVisibleItems, { value: this.#visibleItems })
		this.#emitter.emit(TruncateListEvent.ChangeOverflowItems, { value: this.#overflowItems })
	}
}
