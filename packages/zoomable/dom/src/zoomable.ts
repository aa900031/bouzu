import type { Rect, Size } from '@bouzu/shared'
import { createPoint, createRect, createSize } from '@bouzu/shared'
import type { ZoomableOptions, Zoomable as ZoomableState } from '@bouzu/zoomable'
import { createZoomable as createZoomableState } from '@bouzu/zoomable'

export interface Zoomable {
	state: ZoomableState
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

	function unmount() {
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

		_container = null
		_content = null
	}

	function destroy() {
		state.destroy()
		unmount()
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
		if (!_content)
			throw new Error('No')

		const element = _content.firstElementChild ?? _content
		const style = window.getComputedStyle(element)
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
					client: getRealClientPoint(event),
				},
			],
		})
	}

	function _handleMouseMove(event: MouseEvent) {
		state.handlers.MouseMove({
			touches: [
				{
					client: getRealClientPoint(event),
				},
			],
		})
	}

	function _handleMouseUp(event: MouseEvent) {
		state.handlers.MouseUp({
			touches: [
				{
					client: getRealClientPoint(event),
				},
			],
		})
	}

	function _handleGlobalMouseMove(event: MouseEvent) {
		state.handlers.GlobalMouseMove({
			touches: [
				{
					client: getRealClientPoint(event),
				},
			],
		})
	}
	function _handleGlobalMouseUp(event: MouseEvent) {
		state.handlers.GlobalMouseUp({
			touches: [
				{
					client: getRealClientPoint(event),
				},
			],
		})
	}

	function _handleWheel(event: WheelEvent) {
		event.preventDefault()
		state.handlers.Wheel({
			client: getRealClientPoint(event),
			delta: createPoint(
				event.deltaX,
				event.deltaY,
			),
			withCtrl: event.ctrlKey || event.metaKey,
		})
	}

	function _handleDoubleClick(event: MouseEvent) {
		state.handlers.DoubleClick({
			client: getRealClientPoint(event),
		})
	}

	function getRealClientPoint(event: WheelEvent | MouseEvent) {
		const rect = _getContainerBoundingClientRect()
		return createPoint(
			event.clientX - rect.x,
			event.clientY - rect.y,
		)
	}
}
