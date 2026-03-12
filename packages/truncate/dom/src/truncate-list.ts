import type { TruncateListOptions as TruncateListStateOptions } from '@bouzu/truncate'
import { createSize } from '@bouzu/shared'
import { TruncateList as TruncateListState } from '@bouzu/truncate'

export interface TruncateListOptions extends TruncateListStateOptions {}

export class TruncateList<T> {
	#state: TruncateListState<T>

	#containerElement: HTMLElement | undefined
	#measureElement: HTMLElement | undefined

	#unbindContainerSize: (() => void) | undefined
	#unbindMeasureSize: (() => void) | undefined

	constructor(
		props?: TruncateListOptions,
	) {
		this.#state = new TruncateListState<T>(props)
	}

	get state() {
		return this.#state
	}

	#bindContainerSize() {
		this.#unbindContainerSize?.()

		if (!this.#containerElement)
			return

		const observer = new ResizeObserver(this.#handleContainerResize)
		observer.observe(this.#containerElement)

		return () => {
			observer.disconnect()
		}
	}

	#updateContainerSize() {
		if (!this.#containerElement)
			return

		const rect = this.#containerElement.getBoundingClientRect()
		this.#state.containerSize = createSize(rect.width, rect.height)
	}

	#handleContainerResize = () => {
		this.#updateContainerSize()
	}

	#bindMeasureSize() {
		this.#unbindMeasureSize?.()

		if (!this.#measureElement)
			return

		const observer = new ResizeObserver(this.#handleMeasureResize)
		observer.observe(this.#measureElement)

		return () => {
			observer.disconnect()
		}
	}

	#updateMeasureSize() {
		if (!this.#measureElement)
			return

		const rect = this.#measureElement.getBoundingClientRect()
		this.#state.measureSize = createSize(rect.width, rect.height)
	}

	#handleMeasureResize = () => {
		this.#updateMeasureSize()
	}

	mount(
		container: HTMLElement,
		measure: HTMLElement,
	) {
		this.#containerElement = container
		this.#measureElement = measure

		this.#unbindContainerSize = this.#bindContainerSize()
		this.#unbindMeasureSize = this.#bindMeasureSize()

		document.fonts.ready.then(() => {
			this.state.trigger()
		})
	}

	unmount() {
		this.#unbindContainerSize?.()
		this.#unbindMeasureSize?.()

		this.#containerElement = undefined
		this.#measureElement = undefined
	}

	destroy() {
		this.#state.destroy()
		this.unmount()
	}
}
