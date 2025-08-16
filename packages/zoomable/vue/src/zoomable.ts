import type { ZoomableProps as ZoomableDomProps } from '@bouzu/zoomable-dom'
import { createZoomable } from '@bouzu/zoomable-dom'
import { ZoomableEventName } from '@bouzu/zoomable'
import { type MaybeRef, unrefElement } from '@vueuse/core'
import { markRaw, onScopeDispose, unref, watch } from 'vue-demi'
import type { ToMaybeRefs } from '@bouzu/vue-helper'
import { eventRef, unrefs } from '@bouzu/vue-helper'
import type { Point } from '@bouzu/shared'

export type ZoomableProps =
	& ToMaybeRefs<ZoomableDomProps>
	& {
		disabled?: MaybeRef<boolean | undefined>
	}

export function useZoomable(
	container: MaybeRef<HTMLElement | null | undefined>,
	content: MaybeRef<HTMLElement | null | undefined>,
	props?: ZoomableProps,
) {
	const zoomable = markRaw(createZoomable(
		unrefs(props ?? {}),
	))

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

	propRefSyncer(props?.min, zoomable.state.setMin)
	propRefSyncer(props?.max, zoomable.state.setMax)
	propRefSyncer(props?.initial, zoomable.state.setInitial)
	propRefSyncer(props?.animationDuration, zoomable.state.setAnimationDuration)
	propRefSyncer(props?.enablePan, zoomable.state.setEnablePan)
	propRefSyncer(props?.enablePinch, zoomable.state.setEnablePinch)
	propRefSyncer(props?.enableWheel, zoomable.state.setEnableWheel)

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
