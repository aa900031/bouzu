import type { MaybeRef } from 'vue-demi'
import { onScopeDispose, unref, watch } from 'vue-demi'
import type { View } from '@bouzu/virtualizer'
import { unrefElement } from '@vueuse/core'
import { createVirtualizerItem } from '@bouzu/virtualizer-dom'
import type { VirtualizerContext } from './virtualizer'
import { useVirtualizerContext } from './virtualizer'

export interface UseVirtualizerItemProps<T extends object> {
	el: MaybeRef<HTMLElement | null | undefined>
	view: MaybeRef<View<T>>
}

export function useVirtualizerItem<T extends object>(
	props: UseVirtualizerItemProps<T>,
	context: VirtualizerContext<T> = useVirtualizerContext(),
): void {
	const virtualizerItem = createVirtualizerItem(context.state)

	watch(
		() => unref(props.view),
		(val) => {
			virtualizerItem.updateView(val)
		},
		{ immediate: true, deep: true },
	)

	watch(
		() => unrefElement(props.el),
		(val, _, onCleanup) => {
			if (!val)
				return

			virtualizerItem.mount(val)

			onCleanup(() => {
				virtualizerItem.unmount()
			})
		},
		{ immediate: true, flush: 'post' },
	)

	onScopeDispose(() => {
		virtualizerItem.destroy()
	})
}
