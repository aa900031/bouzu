import type { Rect, Size } from '@bouzu/shared'
import type { Virtualizer as BaseVirtualizer, Layouts, View, VirtualizerEventHandler } from '@bouzu/virtualizer'
import type { CreateVirtualizerProps } from '@bouzu/virtualizer-dom'
import type { MaybeRef } from '@vueuse/core'
import type { InjectionKey, Ref } from 'vue-demi'
import { VirtualizerEvent } from '@bouzu/virtualizer'
import { createVirtualizer } from '@bouzu/virtualizer-dom'
import { eventRef } from '@bouzu/vue-helper'
import { unrefElement } from '@vueuse/core'
import { inject, markRaw, onScopeDispose, onUpdated, provide, unref, watch } from 'vue-demi'
import { toReactiveView } from './reactive-view'

export interface VirtualizerContext<T extends object> {
	state: BaseVirtualizer<T>
}

export interface Virtualizer<T extends object> {
	context: VirtualizerContext<T>
	visibleViews: Readonly<Ref<View<T>[]>>
	visibleRect: Ref<Rect>
	contentSize: Readonly<Ref<Size>>
	isScrolling: Readonly<Ref<boolean>>
	collect: BaseVirtualizer<T>['collect']
}

export interface UseVirtualizerProps<
	T extends object,
> {
	el: MaybeRef<HTMLElement | null | undefined>
	data: MaybeRef<T[]>
	layouts: MaybeRef<Layouts<T>>
	overscanThrottle?: MaybeRef<CreateVirtualizerProps['overscanThrottle']>
	anchorScrollPosition?: MaybeRef<CreateVirtualizerProps['anchorScrollPosition']>
}

const KEY: InjectionKey<VirtualizerContext<any>> = Symbol('@bouzu/vue-virtualizer/virtualizer')
export function useVirtualizerContext<
	T extends object,
>(): VirtualizerContext<T> {
	const value = inject(KEY)
	if (!value)
		throw new Error('Must `useVirtualizer` first')

	return value
}

export function useVirtualizer<T extends object>(
	props: UseVirtualizerProps<T>,
): Virtualizer<T> {
	const virtualizer = markRaw(createVirtualizer<T>({
		overscanThrottle: unref(props.overscanThrottle),
		anchorScrollPosition: unref(props.anchorScrollPosition),
	}))

	const [visibleRect] = eventRef<Rect, VirtualizerEventHandler<T, typeof VirtualizerEvent.ChangeVisibleRect>>({
		register: (handler) => {
			virtualizer.state.on(VirtualizerEvent.ChangeVisibleRect, handler)
			return () => virtualizer.state.off(VirtualizerEvent.ChangeVisibleRect, handler)
		},
		get: e => e?.value ?? virtualizer.state.getVisibleRect(),
		set: val => virtualizer.state.setVisibleRect(val),
	})

	const [isScrolling] = eventRef<boolean, VirtualizerEventHandler<T, typeof VirtualizerEvent.ChangeScrolling>>({
		register: (handler) => {
			virtualizer.state.on(VirtualizerEvent.ChangeScrolling, handler)
			return () => virtualizer.state.off(VirtualizerEvent.ChangeScrolling, handler)
		},
		get: e => e?.value ?? virtualizer.state.getIsScrolling(),
	})

	const [visibleViews] = eventRef<View<T>[], VirtualizerEventHandler<T, typeof VirtualizerEvent.ChangeVisibleViews>>({
		register: (handler) => {
			virtualizer.state.on(VirtualizerEvent.ChangeVisibleViews, handler)
			return () => virtualizer.state.off(VirtualizerEvent.ChangeVisibleViews, handler)
		},
		get: (e) => {
			const views = e?.value ?? virtualizer.state.getVisibleViews()

			const result: View<T>[] = []
			for (const view of views)
				result.push(toReactiveView(view))

			return result
		},
	})

	const [contentSize] = eventRef<Size, VirtualizerEventHandler<T, typeof VirtualizerEvent.ChangeContentSize>>({
		register: (handler) => {
			virtualizer.state.on(VirtualizerEvent.ChangeContentSize, handler)
			return () => virtualizer.state.off(VirtualizerEvent.ChangeContentSize, handler)
		},
		get: e => e?.value ?? virtualizer.state.getContentSize(),
	})

	watch(
		() => unref(props.overscanThrottle),
		(val) => {
			if (val != null)
				virtualizer.state.setOverscanThrottle(val)
		},
		{ flush: 'sync' },
	)

	watch(
		() => unref(props.anchorScrollPosition),
		(val) => {
			if (val != null)
				virtualizer.state.setAnchorScrollPosition(val)
		},
		{ flush: 'sync' },
	)

	watch(
		() => unref(props.data),
		val => virtualizer.state.setData(val as T[]),
		{ immediate: true, flush: 'sync' },
	)

	watch(
		() => unref(props.layouts),
		val => virtualizer.state.setLayouts(val as Layouts<T>),
		{ immediate: true, flush: 'sync' },
	)

	watch(
		() => unrefElement(props.el),
		(val, _, onCleanup) => {
			if (!val)
				return

			virtualizer.mount(val)

			onCleanup(() => {
				virtualizer.unmount()
			})
		},
		{ flush: 'post', immediate: true },
	)

	onUpdated(() => {
		virtualizer.state.collect()
	})

	onScopeDispose(() => {
		virtualizer.destroy()
	})

	const context: VirtualizerContext<T> = {
		state: virtualizer.state,
	}
	provide(KEY, context)

	return {
		context,
		visibleRect,
		contentSize,
		visibleViews,
		isScrolling,
		collect: virtualizer.state.collect,
	}
}
