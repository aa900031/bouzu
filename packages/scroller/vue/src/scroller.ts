import type { InjectionKey, MaybeRef, Ref } from 'vue-demi'
import { inject, markRaw, onScopeDispose, provide, unref, watch } from 'vue-demi'
import type { Rect, Size } from '@bouzu/shared'
import { createRect, toPoint } from '@bouzu/shared'
import type { Scroller as ScrollerDom } from '@bouzu/scroller-dom'
import { createScroller } from '@bouzu/scroller-dom'
import { ScrollerEvent } from '@bouzu/scroller'
import { unrefElement } from '@vueuse/core'
import { eventRef } from '@bouzu/vue-helper'

export interface UseScrollerProps {
	visibleByContent?: MaybeRef<boolean | undefined>
	scrollEventPassive?: MaybeRef<boolean | undefined>
}

export interface ScrollerContext {
	state: ScrollerDom['state']
}

export interface Scroller {
	detect: () => void
	visibleRect: Ref<Rect>
	contentSize: Ref<Size>
	context: ScrollerContext
}

const KEY: InjectionKey<ScrollerContext> = Symbol('@bouzu/vue-scroller/scroller')

export function useScrollerContext(): ScrollerContext {
	const value = inject(KEY)
	if (!value)
		throw new Error('scroller context')
	return value
}

type TargetElement = HTMLElement | null | undefined

export function useScroller(
	el: MaybeRef<TargetElement>,
	props?: UseScrollerProps,
): Scroller {
	const scroller = markRaw(createScroller())

	const [visibleRect] = eventRef({
		register: (handler) => {
			scroller.state.on(ScrollerEvent.ChangeVisibleRect, handler)
			return () => scroller.state.off(ScrollerEvent.ChangeVisibleRect, handler)
		},
		get: () => scroller.state.getVisibleRect() ?? createRect(),
		set: val => scroller.scrollTo(toPoint(val)),
	})

	const [contentSize] = eventRef({
		register: (handler) => {
			scroller.state.on(ScrollerEvent.ChangeContentSize, handler)
			return () => scroller.state.off(ScrollerEvent.ChangeContentSize, handler)
		},
		get: () => scroller.state.getContentSize(),
	})

	watch(
		() => unref(props?.visibleByContent),
		(val) => {
			if (val != null)
				scroller.setVisibleByContent(val)
		},
		{ immediate: true },
	)

	watch(
		() => unref(props?.scrollEventPassive),
		(val) => {
			if (val != null)
				scroller.setScrollEventPassive(val)
		},
		{ immediate: true },
	)

	watch(() => unrefElement<TargetElement>(el), (val, _, onCleanup) => {
		if (!val)
			return

		scroller.mount(val)

		onCleanup(() => {
			scroller.unmount()
		})
	}, { flush: 'post', immediate: true })

	onScopeDispose(() => {
		scroller.destroy()
	})

	const context: ScrollerContext = {
		state: scroller.state,
	}
	provide(KEY, context)

	return {
		context,
		contentSize,
		visibleRect,
		detect: scroller.detect,
	}
}
