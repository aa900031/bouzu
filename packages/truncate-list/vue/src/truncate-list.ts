import type { TruncateCollapseDirectionValues } from '@bouzu/truncate-list'
import type { MaybeRef } from '@vueuse/core'
import type { Ref } from 'vue-demi'
import { createSize } from '@bouzu/shared'
import { TruncateList } from '@bouzu/truncate-list-dom'
import { eventRef } from '@bouzu/vue-helper'
import { unrefElement } from '@vueuse/core'
import { computed, markRaw, nextTick, unref, watch } from 'vue-demi'

export const TruncateCollapseDirection = {
	Start: 'start',
	End: 'end',
} as const

export interface UseTruncateListProps<T> {
	items: MaybeRef<T[]>
	minVisibleCount?: MaybeRef<number | undefined>
	collapseDirection?: MaybeRef<TruncateCollapseDirectionValues>
}

export function useTruncateList<T>(
	containerRef: Ref<HTMLElement | null>,
	measureRef: Ref<HTMLElement | null>,
	props: UseTruncateListProps<T>,
) {
	const truncateList = markRaw(new TruncateList<T>({
		minVisibleCount: unref(props.minVisibleCount),
		collapseDirection: unref(props.collapseDirection),
	}))

	const [visibleItems] = eventRef({
		register: (handler) => {
			truncateList.state.on('change-visible-items', handler)
			return () => truncateList.state.off('change-visible-items', handler)
		},
		get: () => truncateList.state.visibleItems,
	})

	const [overflowItems] = eventRef({
		register: (handler) => {
			truncateList.state.on('change-overflow-items', handler)
			return () => truncateList.state.off('change-overflow-items', handler)
		},
		get: () => truncateList.state.overflowItems,
	})

	const isOverflowing = computed(() => {
		return unref(visibleItems).length < unref(props.items).length
	})

	watch(() => unref(props.items), (val) => {
		truncateList.state.items = val
	}, { immediate: true })

	watch(visibleItems, async () => {
		await nextTick()
		const measureEl = unrefElement(measureRef)
		if (!measureEl)
			return
		const clientRect = measureEl.getBoundingClientRect()
		truncateList.state.measureSize = createSize(clientRect.width, clientRect.height)
	}, { flush: 'post' })

	watch(() => [
		unrefElement(containerRef),
		unrefElement(measureRef),
	] as const, (
		[
			_container,
			_measure,
		],
		_,
		onCleanup,
	) => {
		if (!_container || !_measure)
			return

		truncateList.mount(_container, _measure)

		onCleanup(() => {
			truncateList.unmount()
		})
	}, { flush: 'post' })

	return {
		visibleItems,
		overflowItems,
		isOverflowing,
	}
}
