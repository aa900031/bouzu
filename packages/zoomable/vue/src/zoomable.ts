import { createZoomable } from '@bouzu/zoomable-dom'
import type { ZoomableOptions } from '@bouzu/zoomable'
import { ZoomableEventName } from '@bouzu/zoomable'
import { type MaybeRef, unrefElement } from '@vueuse/core'
import { markRaw, onScopeDispose, unref, watch } from 'vue-demi'
import { eventRef } from '@bouzu/vue-helper'
import type { Point } from '@bouzu/shared'

export function useZoomable(
	container: MaybeRef<HTMLElement | null | undefined>,
	content: MaybeRef<HTMLElement | null | undefined>,
	options?: ZoomableOptions,
) {
	const zoomable = markRaw(createZoomable({
		options: unref(options),
	}))

	const [zoom] = eventRef<number, (value: number) => void>({
		register: (handler) => {
			zoomable.state.on(ZoomableEventName.ChangeZoom, handler)
			return () => zoomable.state.off(ZoomableEventName.ChangeZoom, handler)
		},
		get: e => e ?? zoomable.state.getZoom(),
		set: val => zoomable.state.updateTo(val),
	})

	const [pan] = eventRef<Point, (value: Point) => void>({
		register: (handler) => {
			zoomable.state.on(ZoomableEventName.ChangePan, handler)
			return () => zoomable.state.off(ZoomableEventName.ChangePan, handler)
		},
		get: e => e ?? zoomable.state.getPan(),
	})

	watch(() => [
		unrefElement(container),
		unrefElement(content),
	] as const, (
		[
			_container,
			_content,
		],
		_,
		onCleanup,
	) => {
		if (!_container || !_content)
			return

		zoomable.mount(_container, _content)

		onCleanup(() => {
			zoomable.unmount()
		})
	}, { flush: 'post', immediate: true })

	onScopeDispose(() => {
		zoomable.destroy()
	})

	return {
		state: zoomable.state,
		zoom,
		pan,
	}
}
