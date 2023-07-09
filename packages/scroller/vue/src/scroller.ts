import type { InjectionKey, MaybeRef, Ref } from 'vue-demi'
import { inject, onScopeDispose, provide, unref, watch } from 'vue-demi'
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

const ScrollerContextKey: InjectionKey<ScrollerContext> = Symbol('@bouzu/vue-scroller/scroller')

export function useScrollerContext(): ScrollerContext {
	const value = inject(ScrollerContextKey)
	if (!value)
		throw new Error('scroller context')
	return value
}

type TargetElement = HTMLElement | null | undefined

export function useScroller(
	el: MaybeRef<TargetElement>,
	props?: UseScrollerProps,
): Scroller {
	const _scroller = createScroller()

	const [visibleRect] = eventRef({
		register: (handler) => {
			_scroller.state.on(ScrollerEvent.ChangeVisibleRect, handler)
			return () => _scroller.state.off(ScrollerEvent.ChangeVisibleRect, handler)
		},
		get: () => _scroller.state.getVisibleRect() ?? createRect(),
		set: val => _scroller.scrollTo(toPoint(val)),
	})

	const [contentSize] = eventRef({
		register: (handler) => {
			_scroller.state.on(ScrollerEvent.ChangeContentSize, handler)
			return () => _scroller.state.off(ScrollerEvent.ChangeContentSize, handler)
		},
		get: () => _scroller.state.getContentSize(),
	})

	const context: ScrollerContext = {
		state: _scroller.state,
	}

	watch(() => unref(props?.visibleByContent), (val) => {
		if (val != null)
			_scroller.setVisibleByContent(val)
	}, { immediate: true })

	watch(() => unref(props?.scrollEventPassive), (val) => {
		if (val != null)
			_scroller.setScrollEventPassive(val)
	}, { immediate: true })

	watch(() => unrefElement<TargetElement>(el), (val, _, onCleanup) => {
		if (!val)
			return

		_scroller.mount(val)

		onCleanup(() => {
			_scroller.unmount()
		})
	}, { flush: 'post', immediate: true })

	onScopeDispose(() => {
		_scroller.destroy()
	})

	provide(ScrollerContextKey, context)

	return {
		context,
		contentSize,
		visibleRect,
		detect: _scroller.detect,
	}
}
