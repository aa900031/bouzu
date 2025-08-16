import type { Rect, Size } from '@bouzu/shared'
import { createPoint, createRect, createSize } from '@bouzu/shared'
import type { ZoomableOptions, Zoomable as ZoomableState } from '@bouzu/zoomable'
import { createZoomable as createZoomableState } from '@bouzu/zoomable'

export interface Zoomable {
	state: ZoomableState
	start: () => void
	stop: () => void
	mount: (container: HTMLElement, element: HTMLElement) => void
	unmount: () => void
	destroy: () => void
}

export interface CreateZoomableProps {
	options?: ZoomableOptions
}

export function createZoomable(
	props?: CreateZoomableProps,
): Zoomable {
	const state = createZoomableState({
		getContainerBoundingClientRect: _getContainerBoundingClientRect,
		getElementStyleSize: _getElementStyleSize,
		options: props?.options,
	})

	let _container: HTMLElement | null = null
	let _content: HTMLElement | null = null

	return {
		state,
		start,
		stop,
		mount,
		unmount,
		destroy,
	}

	function mount(
		container: HTMLElement,
		content: HTMLElement,
	) {
		_container = container
		_content = content
	}

	function unmount() {
		_container = null
		_content = null
	}

	function stop() {
		if (_container) {
			_container.removeEventListener('touchstart', _handleTouchStart)
			_container.removeEventListener('touchmove', _handleTouchMove)
			_container.removeEventListener('touchend', _handleTouchEnd)
			_container.removeEventListener('touchcancel', _handleTouchEnd)
			_container.removeEventListener('mousedown', _handleMouseDown)
			_container.removeEventListener('mousemove', _handleMouseMove)
			_container.removeEventListener('mouseup', _handleMouseUp)
			_container.removeEventListener('wheel', _handleWheel)
			_container.removeEventListener('dblclick', _handleDoubleClick)
			document.removeEventListener('mousemove', _handleGlobalMouseMove)
			document.removeEventListener('mouseup', _handleGlobalMouseUp)
		}
	}

	function start() {
		if (_container) {
			_container.addEventListener('touchstart', _handleTouchStart)
			_container.addEventListener('touchmove', _handleTouchMove)
			_container.addEventListener('touchend', _handleTouchEnd)
			_container.addEventListener('touchcancel', _handleTouchEnd)
			_container.addEventListener('mousedown', _handleMouseDown)
			_container.addEventListener('mousemove', _handleMouseMove)
			_container.addEventListener('mouseup', _handleMouseUp)
			_container.addEventListener('wheel', _handleWheel, { passive: false })
			_container.addEventListener('dblclick', _handleDoubleClick)
			document.addEventListener('mousemove', _handleGlobalMouseMove)
			document.addEventListener('mouseup', _handleGlobalMouseUp)
		}
	}

	function destroy() {
		state.destroy()
		stop()
		unmount()
	}

	function _getContainerBoundingClientRect(): Rect {
		if (!_container)
			throw new Error('No')

		const rect = _container.getBoundingClientRect()
		return createRect(
			rect.x,
			rect.y,
			rect.width,
			rect.height,
		)
	}

	function _getElementStyleSize(): Size {
		if (!_content)
			throw new Error('No')

		const style = window.getComputedStyle(_content)
		const width = Number.parseFloat(style.width)
		const height = Number.parseFloat(style.height)

		return createSize(
			width,
			height,
		)
	}

	function _handleTouchStart(event: TouchEvent) {
		event.preventDefault()
		state.handlers.TouchStart({
			touches: [...event.touches].map(item => ({
				client: createPoint(
					item.clientX,
					item.clientY,
				),
			})),
		})
	}

	function _handleTouchMove(event: TouchEvent) {
		state.handlers.TouchMove({
			touches: [...event.touches].map(item => ({
				client: createPoint(
					item.clientX,
					item.clientY,
				),
			})),
		})
	}

	function _handleTouchEnd(event: TouchEvent) {
		state.handlers.TouchEnd({
			touches: [...event.touches].map(item => ({
				client: createPoint(
					item.clientX,
					item.clientY,
				),
			})),
		})
	}

	function _handleMouseDown(event: MouseEvent) {
		event.preventDefault()
		state.handlers.MouseDown({
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

	function _handleMouseMove(event: MouseEvent) {
		state.handlers.MouseMove({
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

	function _handleMouseUp(event: MouseEvent) {
		state.handlers.MouseUp({
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

	function _handleGlobalMouseMove(event: MouseEvent) {
		state.handlers.GlobalMouseMove({
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
	function _handleGlobalMouseUp(event: MouseEvent) {
		state.handlers.GlobalMouseUp({
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

	function _handleWheel(event: WheelEvent) {
		event.preventDefault()
		const rect = _getContainerBoundingClientRect()

		state.handlers.Wheel({
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

	function _handleDoubleClick(event: MouseEvent) {
		state.handlers.DoubleClick({
			client: createPoint(
				event.clientX,
				event.clientY,
			),
		})
	}
}
