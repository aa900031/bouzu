import type { Point } from '@bouzu/shared'
import type { ToMaybeRefs } from '@bouzu/vue-helper'
import type { ZoomableProps as ZoomableDomProps } from '@bouzu/zoomable-dom'
import type { MaybeRef } from '@vueuse/core'
import { eventRef, unrefs } from '@bouzu/vue-helper'
import { ZoomableEventName } from '@bouzu/zoomable'
import { Zoomable } from '@bouzu/zoomable-dom'
import { unrefElement } from '@vueuse/core'
import { markRaw, onScopeDispose, unref, watch } from 'vue-demi'

export type ZoomableProps
	= & ToMaybeRefs<ZoomableDomProps>
		& {
			disabled?: MaybeRef<boolean | undefined>
		}

export function useZoomable(
	container: MaybeRef<HTMLElement | null | undefined>,
	content: MaybeRef<HTMLElement | null | undefined>,
	props?: ZoomableProps,
) {
	const zoomable = markRaw(new Zoomable(
		unrefs(props ?? {}),
	))

	const [zoom] = eventRef<number, (value: number) => void>({
		register: (handler) => {
			zoomable.state.on(ZoomableEventName.ChangeZoom, handler)
			return () => zoomable.state.off(ZoomableEventName.ChangeZoom, handler)
		},
		get: e => e ?? zoomable.state.zoom,
		set: val => zoomable.state.zoom = val,
	})

	const [pan] = eventRef<Point, (value: Point) => void>({
		register: (handler) => {
			zoomable.state.on(ZoomableEventName.ChangePan, handler)
			return () => zoomable.state.off(ZoomableEventName.ChangePan, handler)
		},
		get: e => e ?? zoomable.state.pan,
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
		if (unref(props?.disabled) !== true)
			return zoomable.start()

		onCleanup(() => {
			zoomable.stop()
			zoomable.unmount()
		})
	}, { flush: 'post', immediate: true })

	watch(() => unref(props?.disabled), (val) => {
		if (val === true)
			zoomable.stop()
		else
			zoomable.start()
	}, { immediate: true })

	propRefSyncer(props?.min, val => zoomable.state.min = val)
	propRefSyncer(props?.max, val => zoomable.state.max = val)
	propRefSyncer(props?.initial, val => zoomable.state.initial = val)
	propRefSyncer(props?.animationDuration, val => zoomable.state.animationDuration = val)
	propRefSyncer(props?.enablePan, val => zoomable.state.enablePan = val)
	propRefSyncer(props?.enablePinch, val => zoomable.state.enablePinch = val)
	propRefSyncer(props?.enableWheel, val => zoomable.state.enableWheel = val)

	onScopeDispose(() => {
		zoomable.destroy()
	})

	return {
		state: zoomable.state,
		zoom,
		pan,
	}
}

function propRefSyncer<T>(
	ref: MaybeRef<T | undefined> | undefined,
	setter: (val: T) => void,
) {
	watch(
		() => unref(ref),
		val => val != null && setter(val),
	)
}
