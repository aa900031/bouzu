import type { Rect, Size } from '@bouzu/shared'
import { createPoint, createRect, createSize } from '@bouzu/shared'
import type { Zoomable as ZoomableState } from '@bouzu/zoomable'
import { createZoomable as createZoomableState } from '@bouzu/zoomable'

export interface Zoomable {
	state: ZoomableState
	mount: (container: HTMLElement, element: HTMLElement) => void
	unmount: () => void
}

export function createZoomable(

): Zoomable {
	const state = createZoomableState({
		getContainerBoundingClientRect: _getContainerBoundingClientRect,
		getElementStyleSize: _getElementStyleSize,
	})

	let _container: HTMLElement | null = null
	let _element: HTMLElement | null = null

	return {
		state,
		mount,
		unmount,
	}

	function mount(
		container: HTMLElement,
		element: HTMLElement,
	) {
		_container = container
		_element = element

		_container.addEventListener('touchstart', _handleTouchStart)
		_container.addEventListener('touchmove', _handleTouchMove)
		_container.addEventListener('touchend', _handleTouchEnd)
		_container.addEventListener('touchcancel', _handleTouchEnd)
		_container.addEventListener('mousedown', _handleMouseDown)
		_container.addEventListener('mousemove', _handleMouseMove)
		_container.addEventListener('mouseup', _handleMouseUp)
		_container.addEventListener('wheel', _handleWheel)
		document.addEventListener('mousemove', _handleGlobalMouseMove)
		document.addEventListener('mouseup', _handleGlobalMouseUp)
	}

	function unmount() {
		if (_container) {
			_container.addEventListener('touchstart', _handleTouchStart)
			_container.addEventListener('touchmove', _handleTouchMove)
			_container.addEventListener('touchend', _handleTouchEnd)
			_container.addEventListener('touchcancel', _handleTouchEnd)
			_container.addEventListener('mousedown', _handleMouseDown)
			_container.addEventListener('mousemove', _handleMouseMove)
			_container.addEventListener('mouseup', _handleMouseUp)
			_container.addEventListener('wheel', _handleWheel)
			document.addEventListener('mousemove', _handleGlobalMouseMove)
			document.addEventListener('mouseup', _handleGlobalMouseUp)
		}

		_container = null
		_element = null
	}

	function _getContainerBoundingClientRect(): Rect {
		if (!_container)
			throw new Error('No')

		const rect = _container.getBoundingClientRect()
		return createRect(
			rect.left,
			rect.top,
			rect.width,
			rect.height,
		)
	}

	function _getElementStyleSize(): Size {
		if (!_element)
			throw new Error('No')

		const style = window.getComputedStyle(_element)
		const width = Number.parseFloat(style.width)
		const height = Number.parseFloat(style.height)

		return createSize(
			width,
			height,
		)
	}

	function _handleTouchStart(event: TouchEvent) {
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
		state.handlers.Wheel({
			client: createPoint(
				event.clientX,
				event.clientY,
			),
			delta: createPoint(
				event.deltaX,
				event.deltaY,
			),
			withCtrl: event.ctrlKey || event.metaKey,
		})
	}
}
