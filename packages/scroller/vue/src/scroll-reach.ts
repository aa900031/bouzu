import type { Ref } from 'vue-demi'
import { onScopeDispose, unref } from 'vue-demi'
import { eventRef } from '@bouzu/vue-helper'
import type { ReachEventHandler, ReachValue } from '@bouzu/scroller'
import { Reach, ReachEvent, createReachPlugin } from '@bouzu/scroller'
import { computedEager } from '@vueuse/core'
import type { ScrollerContext } from './scroller'
import { useScrollerContext } from './scroller'

export interface ScrollReach {
	value: Readonly<Ref<ReachValue | null>>
	isTop: Readonly<Ref<boolean>>
	isBottom: Readonly<Ref<boolean>>
	isLeft: Readonly<Ref<boolean>>
	isRight: Readonly<Ref<boolean>>
}

export function useScrollReach(
	context: ScrollerContext = useScrollerContext(),
): ScrollReach {
	const reach = createReachPlugin()

	const [value] = eventRef<ReachValue | null, ReachEventHandler<typeof ReachEvent.Change>>({
		register: (handler) => {
			context.state.addPlugin(reach)
			reach.on(ReachEvent.Change, handler)
			return () => reach.off(ReachEvent.Change, handler)
		},
		get: event => event?.value ?? reach.get(),
	})

	onScopeDispose(() => {
		reach.destroy(context.state)
	})

	return {
		value,
		isTop: computedEager(() => unref(value) === Reach.Top),
		isBottom: computedEager(() => unref(value) === Reach.Bottom),
		isLeft: computedEager(() => unref(value) === Reach.Left),
		isRight: computedEager(() => unref(value) === Reach.Right),
	}
}
