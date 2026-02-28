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
	#prevContainerValue: number | undefined
	#prevMeasureValue: number | undefined
	#currentRight: number | undefined

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
		this.trigger()
	}

	get containerSize() {
		return this.#containerSize
	}

	set containerSize(value) {
		if (this.#containerSize && value && checkSizeEqual(this.#containerSize, value))
			return

		this.#containerSize = value
		this.trigger()
	}

	get measureSize() {
		return this.#measureSize
	}

	set measureSize(value) {
		if (this.#measureSize && value && checkSizeEqual(this.#measureSize, value))
			return

		this.#measureSize = value
		this.trigger()
	}

	get axis() {
		return this.#axis
	}

	set axis(value) {
		if (this.#axis !== value)
			return

		this.#prevContainerValue = undefined
		this.#prevMeasureValue = undefined
		this.#axis = value
		this.trigger()
	}

	get visibleItems() {
		return this.#visibleItems
	}

	get overflowItems() {
		return this.#overflowItems
	}

	public trigger() {
		if (this.containerSize == null || this.measureSize == null)
			return

		const containerValue = getSizeByAxis(this.containerSize, this.axis)
		const isChangedContainerValue = this.#prevContainerValue !== containerValue
		const measureValue = getSizeByAxis(this.measureSize, this.axis)
		const isChangedMeasureValue = this.#prevMeasureValue !== measureValue
		if (!isChangedContainerValue && !isChangedMeasureValue) {
			this.#currentRight = undefined
			return
		}

		let left = this.minVisibleCount
		let right = this.#currentRight ?? this.items.length
		const mid = Math.ceil((left + right) / 2)
		if (measureValue >= 0.8) {
			left = mid
		}
		else {
			right = mid - 1
		}
		this.#currentRight = right

		switch (this.collapseDirection) {
			case TruncateCollapseDirection.Start:
				this.#visibleItems = this.items.slice(this.items.length - left)
				this.#emitter.emit(TruncateListEvent.ChangeVisibleItems, { value: this.#visibleItems })
				this.#overflowItems = this.items.slice(this.#visibleItems.length)
				this.#emitter.emit(TruncateListEvent.ChangeOverflowItems, { value: this.#overflowItems })
				break
			case TruncateCollapseDirection.End:
				this.#visibleItems = this.items.slice(0, left)
				this.#emitter.emit(TruncateListEvent.ChangeVisibleItems, { value: this.#visibleItems })
				this.#overflowItems = this.items.slice(this.#visibleItems.length)
				this.#emitter.emit(TruncateListEvent.ChangeOverflowItems, { value: this.#overflowItems })
				break
		}

		if (isChangedContainerValue)
			this.#prevContainerValue = containerValue
		if (isChangedMeasureValue)
			this.#prevMeasureValue = measureValue
	}
}
