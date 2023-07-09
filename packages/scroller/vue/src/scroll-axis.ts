import type { Ref } from 'vue-demi'
import { onScopeDispose, unref } from 'vue-demi'
import { eventRef } from '@bouzu/vue-helper'
import { computedEager } from '@vueuse/core'
import type { AxisEventHandler } from '@bouzu/scroller'
import { Axis, AxisEvent, createAxisPlugin } from '@bouzu/scroller'
import type { ScrollerContext } from './scroller'
import { useScrollerContext } from './scroller'

export interface ScrollAxis {
	value: Readonly<Ref<Axis | null>>
	isX: Readonly<Ref<boolean>>
	isY: Readonly<Ref<boolean>>
}

export function useScrollAxis(
	context: ScrollerContext = useScrollerContext(),
): ScrollAxis {
	const axis = createAxisPlugin()

	const [value] = eventRef<Axis | null, AxisEventHandler<typeof AxisEvent.Change>>({
		register: (handler) => {
			axis.on(AxisEvent.Change, handler)
			context.state.addPlugin(axis)
			return () => axis.off(AxisEvent.Change, handler)
		},
		get: event => event?.value ?? axis.get(),
	})

	onScopeDispose(() => {
		axis.destroy(context.state)
	})

	return {
		value,
		isX: computedEager(() => unref(value) === Axis.X),
		isY: computedEager(() => unref(value) === Axis.Y),
	}
}
