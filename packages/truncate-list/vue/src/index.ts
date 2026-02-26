import type { MaybeRef } from '@vueuse/core'
import type { Ref } from 'vue-demi'
import { Axis, createSize, getSizeByAxis } from '@bouzu/shared'
import { useElementSize } from '@vueuse/core'
import { nextTick, shallowReactive, shallowReadonly, unref, watch } from 'vue-demi'

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

	watch(() => unref(props.items), () => {
		showAll()
		onMeasure()
	}, { flush: 'post' })

	watch([width, height], ([_width, _height], [_oldWidth, _oldHeight]) => {
		const current = getSizeByAxis(createSize(_width, _height), axis)
		const prev = getSizeByAxis(createSize(_oldWidth, _oldHeight), axis)
		if (current > prev)
			showAll()
		onMeasure()
	})

	return {
		visibleItems: shallowReadonly(visibleItems),
	}

	function showAll() {
		if (visibleItems.length === unref(props.items).length)
			return
		visibleItems.length = 0
		visibleItems.push(...unref(props.items).slice())
	}

	function onMeasure() {
		measuring = measuring.then(() => remeasure())
	}

	async function remeasure() {
		const measureSize = getMeasureSize()
		const value = getSizeByAxis(measureSize, axis)
		if (value > 0.8 || visibleItems.length <= (unref(props.minVisibleItemsNum) ?? 0))
			return

		const collapseDirection = unref(props.collapseDirection)

		if (collapseDirection === TruncateCollapseDirection.End) {
			visibleItems.pop()
		}
		else if (collapseDirection == null || collapseDirection === TruncateCollapseDirection.Start) {
			visibleItems.shift()
		}
		await nextTick()
		return remeasure()
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
