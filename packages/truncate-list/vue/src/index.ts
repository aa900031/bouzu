import type { MaybeRef } from '@vueuse/core'
import type { Ref } from 'vue-demi'
import { Axis, createSize, getSizeByAxis } from '@bouzu/shared'
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, shallowReactive, shallowReadonly, unref, watch } from 'vue-demi'

export const TruncateCollapseDirection = {
	Start: 'start',
	End: 'end',
} as const

export interface UseTruncateListProps<T> {
	containerRef: Ref<HTMLElement | null>
	measureRef: Ref<HTMLElement | null>
	items: MaybeRef<T[]>
	minVisibleItemsNum?: MaybeRef<number | undefined>
	collapseDirection?: MaybeRef<typeof TruncateCollapseDirection[keyof typeof TruncateCollapseDirection] | undefined>
}

export function useTruncateList<T>(
	props: UseTruncateListProps<T>,
) {
	let measuring: Promise<void> = Promise.resolve()
	const axis = Axis.X
	const { width, height } = useElementSize(props.containerRef)

	const visibleItems = shallowReactive<T[]>(
		unref(props.items).slice(),
	)
	const isOverflowing = computed(() => {
		return visibleItems.length < unref(props.items).length
	})
	const overflowItems = computed(() => unref(props.items).slice(visibleItems.length))

	watch(() => unref(props.items), () => {
		onMeasure()
	}, { flush: 'post' })

	watch([width, height], ([_width, _height], [_oldWidth, _oldHeight]) => {
		const current = getSizeByAxis(createSize(_width, _height), axis)
		const prev = getSizeByAxis(createSize(_oldWidth, _oldHeight), axis)
		if (current === prev)
			return
		onMeasure()
	})

	return {
		visibleItems: shallowReadonly(visibleItems),
		overflowItems,
		isOverflowing,
	}

	function onMeasure() {
		measuring = measuring.then(() => remeasure())
	}

	async function remeasure() {
		const items = unref(props.items)
		const min = unref(props.minVisibleItemsNum) ?? 0
		const collapseDirection = unref(props.collapseDirection) ?? TruncateCollapseDirection.End

		let left = min
		let right = items.length

		while (left < right) {
			const mid = Math.ceil((left + right) / 2)

			visibleItems.length = 0
			if (collapseDirection === TruncateCollapseDirection.Start) {
				visibleItems.push(...items.slice(items.length - mid))
			}
			else {
				visibleItems.push(...items.slice(0, mid))
			}

			await nextTick()

			const measureSize = getMeasureSize()
			const value = getSizeByAxis(measureSize, axis)

			if (value >= 0.8) {
				left = mid
			}
			else {
				right = mid - 1
			}
		}

		visibleItems.length = 0
		if (collapseDirection === TruncateCollapseDirection.Start) {
			visibleItems.push(...items.slice(items.length - left))
		}
		else {
			visibleItems.push(...items.slice(0, left))
		}
	}

	function getMeasureSize() {
		const el = unref(props.measureRef)
		const clientRect = el?.getBoundingClientRect?.()

		return createSize(
			clientRect?.width ?? 0,
			clientRect?.height ?? 0,
		)
	}
}
