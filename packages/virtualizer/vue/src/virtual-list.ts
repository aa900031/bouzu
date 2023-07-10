import type { MaybeRef } from 'vue-demi'
import { markRaw, unref, watch } from 'vue-demi'
import type { CreateListLayoutsOptions } from '@bouzu/virtualizer'
import { createListLayouts } from '@bouzu/virtualizer'
import type { UseVirtualizerProps, Virtualizer } from './virtualizer'
import { useVirtualizer } from './virtualizer'

export type VirtualList<T extends object> = Virtualizer<T>

export type UseVirtualListProps<T extends object> =
	& Omit<UseVirtualizerProps<T>, 'layouts'>
	& {
		axis?: MaybeRef<CreateListLayoutsOptions['axis']>
		itemSize?: MaybeRef<CreateListLayoutsOptions['itemSize']>
		estimatedItemSize?: MaybeRef<CreateListLayoutsOptions['estimatedItemSize']>
	}

export function useVirtualList<T extends object>(
	props: UseVirtualListProps<T>,
): VirtualList<T> {
	const layouts = markRaw(createListLayouts<T>({
		axis: unref(props.axis),
		itemSize: unref(props.itemSize),
		estimatedItemSize: unref(props.estimatedItemSize),
	}))

	watch(
		() => unref(props.axis),
		(val) => {
			if (val != null)
				layouts.setAxis(val)
		},
		{ flush: 'sync' },
	)

	watch(
		() => unref(props.itemSize),
		(val) => {
			if (val != null)
				layouts.setItemSize(val)
		},
		{ flush: 'sync' },
	)

	watch(
		() => unref(props.estimatedItemSize),
		(val) => {
			if (val != null)
				layouts.setEstimatedItemSize(val)
		},
		{ flush: 'sync' },
	)

	return useVirtualizer({
		...props,
		layouts,
	})
}
