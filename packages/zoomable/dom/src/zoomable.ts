import type { Rect, Size } from '@bouzu/shared'
import type { ZoomableProps as ZoomableStateProps } from '@bouzu/zoomable'
import { createPoint, createRect, createSize } from '@bouzu/shared'
import { Zoomable as ZoomableState } from '@bouzu/zoomable'

export type ZoomableProps = Omit<
	ZoomableStateProps,
	| 'getContainerBoundingClientRect'
	| 'getElementStyleSize'
>

export class Zoomable {
	#container: HTMLElement | undefined
	#content: HTMLElement | undefined
	#state: ZoomableState

	constructor(props?: ZoomableProps) {
		this.#state = new ZoomableState({
			getContainerBoundingClientRect: this.#getContainerBoundingClientRect.bind(this),
			getElementStyleSize: this.#getElementStyleSize.bind(this),
			...props,
		})
	}

	get state() {
		return this.#state
	}

	mount(container: HTMLElement, content: HTMLElement) {
		this.#container = container
		this.#content = content
	}

	unmount() {
		this.#container = undefined
		this.#content = undefined
	}

	stop() {
		if (this.#container) {
			this.#container.removeEventListener('touchstart', this.#handleTouchStart)
			this.#container.removeEventListener('touchmove', this.#handleTouchMove)
			this.#container.removeEventListener('touchend', this.#handleTouchEnd)
			this.#container.removeEventListener('touchcancel', this.#handleTouchEnd)
			this.#container.removeEventListener('mousedown', this.#handleMouseDown)
			this.#container.removeEventListener('mousemove', this.#handleMouseMove)
			this.#container.removeEventListener('mouseup', this.#handleMouseUp)
			this.#container.removeEventListener('wheel', this.#handleWheel)
			this.#container.removeEventListener('dblclick', this.#handleDoubleClick)
			document.removeEventListener('mousemove', this.#handleGlobalMouseMove)
			document.removeEventListener('mouseup', this.#handleGlobalMouseUp)
		}
	}

	start() {
		if (this.#container) {
			this.#container.addEventListener('touchstart', this.#handleTouchStart)
			this.#container.addEventListener('touchmove', this.#handleTouchMove)
			this.#container.addEventListener('touchend', this.#handleTouchEnd)
			this.#container.addEventListener('touchcancel', this.#handleTouchEnd)
			this.#container.addEventListener('mousedown', this.#handleMouseDown)
			this.#container.addEventListener('mousemove', this.#handleMouseMove)
			this.#container.addEventListener('mouseup', this.#handleMouseUp)
			this.#container.addEventListener('wheel', this.#handleWheel, { passive: false })
			this.#container.addEventListener('dblclick', this.#handleDoubleClick)
			document.addEventListener('mousemove', this.#handleGlobalMouseMove)
			document.addEventListener('mouseup', this.#handleGlobalMouseUp)
		}
	}

	destroy() {
		this.#state.destroy()
		this.stop()
		this.unmount()
	}

	#getContainerBoundingClientRect(): Rect {
		if (!this.#container)
			throw new Error('No container')

		const rect = this.#container.getBoundingClientRect()
		return createRect(
			rect.x,
			rect.y,
			rect.width,
			rect.height,
		)
	}

	#getElementStyleSize(): Size {
		if (!this.#content)
			throw new Error('No content')

		const style = window.getComputedStyle(this.#content)
		const width = Number.parseFloat(style.width)
		const height = Number.parseFloat(style.height)

		return createSize(
			width,
			height,
		)
	}

	#handleTouchStart = (event: TouchEvent) => {
		event.preventDefault()
		this.#state.handlers.TouchStart({
			touches: [...event.touches].map(item => ({
				client: createPoint(
					item.clientX,
					item.clientY,
				),
			})),
		})
	}

	#handleTouchMove = (event: TouchEvent) => {
		this.#state.handlers.TouchMove({
			touches: [...event.touches].map(item => ({
				client: createPoint(
					item.clientX,
					item.clientY,
				),
			})),
		})
	}

	#handleTouchEnd = (event: TouchEvent) => {
		this.#state.handlers.TouchEnd({
			touches: [...event.touches].map(item => ({
				client: createPoint(
					item.clientX,
					item.clientY,
				),
			})),
		})
	}

	#handleMouseDown = (event: MouseEvent) => {
		event.preventDefault()
		this.#state.handlers.MouseDown({
			touches: [
				{
					client: createPoint(
						event.clientX,
						event.clientY,
					),
				},
			],
		})
	}

	#handleMouseMove = (event: MouseEvent) => {
		this.#state.handlers.MouseMove({
			touches: [
				{
					client: createPoint(
						event.clientX,
						event.clientY,
					),
				},
			],
		})
	}

	#handleMouseUp = (event: MouseEvent) => {
		this.#state.handlers.MouseUp({
			touches: [
				{
					client: createPoint(
						event.clientX,
						event.clientY,
					),
				},
			],
		})
	}

	#handleGlobalMouseMove = (event: MouseEvent) => {
		this.#state.handlers.GlobalMouseMove({
			touches: [
				{
					client: createPoint(
						event.clientX,
						event.clientY,
					),
				},
			],
		})
	}

	#handleGlobalMouseUp = (event: MouseEvent) => {
		this.#state.handlers.GlobalMouseUp({
			touches: [
				{
					client: createPoint(
						event.clientX,
						event.clientY,
					),
				},
			],
		})
	}

	#handleWheel = (event: WheelEvent) => {
		event.preventDefault()
		const rect = this.#getContainerBoundingClientRect()

		this.#state.handlers.Wheel({
			client: createPoint(
				event.clientX - rect.x,
				event.clientY - rect.y,
			),
			delta: createPoint(
				event.deltaX,
				event.deltaY,
			),
			withCtrl: event.ctrlKey,
		})
	}

	#handleDoubleClick = (event: MouseEvent) => {
		this.#state.handlers.DoubleClick({
			client: createPoint(
				event.clientX,
				event.clientY,
			),
		})
	}
}
