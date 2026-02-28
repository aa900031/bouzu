import type { TruncateCollapseDirectionValues } from '@bouzu/truncate-list'
import type { MaybeRef } from '@vueuse/core'
import type { Ref } from 'vue-demi'
import { createSize } from '@bouzu/shared'
import { TruncateList } from '@bouzu/truncate-list'
import { eventRef } from '@bouzu/vue-helper'
import { useElementSize } from '@vueuse/core'
import { computed, shallowReadonly, unref, watch } from 'vue-demi'

export const TruncateCollapseDirection = {
	Start: 'start',
	End: 'end',
} as const

export interface UseTruncateListProps<T> {
	containerRef: Ref<HTMLElement | null>
	measureRef: Ref<HTMLElement | null>
	items: MaybeRef<T[]>
	minVisibleCount?: MaybeRef<number | undefined>
	collapseDirection?: MaybeRef<TruncateCollapseDirectionValues>
}

export function useTruncateList<T>(
	props: UseTruncateListProps<T>,
) {
	const containerSize = useElementSize(props.containerRef)
	const measureSize = useElementSize(props.measureRef)

	const state = new TruncateList({
		minVisibleCount: unref(props.minVisibleCount),
		collapseDirection: unref(props.collapseDirection),
	})

	const [visibleItems] = eventRef({
		register: (handler) => {
			state.on('change-visible-items', handler)
			return () => state.off('change-visible-items', handler)
		},
		get: () => state.visibleItems,
	})

	const [overflowItems] = eventRef({
		register: (handler) => {
			state.on('change-overflow-items', handler)
			return () => state.off('change-overflow-items', handler)
		},
		get: () => state.overflowItems,
	})

	const isOverflowing = computed(() => {
		return unref(visibleItems).length < unref(props.items).length
	})

	watch(() => unref(props.containerRef), async () => {
		await document.fonts.ready
		state.trigger()
	}, { flush: 'post' })

	watch(() => unref(props.items), (val) => {
		state.items = val
	}, { immediate: true })

	watch(
		() => createSize(
			unref(containerSize.width),
			unref(containerSize.height),
		),
		(val) => {
			state.containerSize = val
		},
	)

	watch(
		() => createSize(
			unref(measureSize.width),
			unref(measureSize.height),
		),
		(val) => {
			state.measureSize = val
		},
	)

	return {
		visibleItems: shallowReadonly(visibleItems),
		overflowItems,
		isOverflowing,
	}
}
