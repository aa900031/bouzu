import type { ReachEventHandler, ReachValue } from '@bouzu/scroller'
import type { Ref } from 'vue-demi'
import type { ScrollerContext } from './scroller'
import { createReachPlugin, Reach, ReachEvent } from '@bouzu/scroller'
import { eventRef } from '@bouzu/vue-helper'
import { computedEager } from '@vueuse/core'
import { onScopeDispose, unref } from 'vue-demi'
import { useScrollerContext } from './scroller'

export interface ScrollReach {
	x: Readonly<Ref<ReachValue | null>>
	y: Readonly<Ref<ReachValue | null>>
	isTop: Readonly<Ref<boolean>>
	isBottom: Readonly<Ref<boolean>>
	isLeft: Readonly<Ref<boolean>>
	isRight: Readonly<Ref<boolean>>
}

export function useScrollReach(
	context: ScrollerContext = useScrollerContext(),
): ScrollReach {
	const reach = createReachPlugin()

	const [x] = eventRef<ReachValue | null, ReachEventHandler<typeof ReachEvent.ChangeX>>({
		register: (handler) => {
			context.state.addPlugin(reach)
			reach.on(ReachEvent.ChangeX, handler)
			return () => reach.off(ReachEvent.ChangeX, handler)
		},
		get: event => event?.value ?? reach.getX(),
	})

	const [y] = eventRef<ReachValue | null, ReachEventHandler<typeof ReachEvent.ChangeY>>({
		register: (handler) => {
			context.state.addPlugin(reach)
			reach.on(ReachEvent.ChangeY, handler)
			return () => reach.off(ReachEvent.ChangeY, handler)
		},
		get: event => event?.value ?? reach.getY(),
	})

	onScopeDispose(() => {
		reach.destroy(context.state)
	})

	return {
		x,
		y,
		isTop: computedEager(() => unref(y) === Reach.Top),
		isBottom: computedEager(() => unref(y) === Reach.Bottom),
		isLeft: computedEager(() => unref(x) === Reach.Left),
		isRight: computedEager(() => unref(x) === Reach.Right),
	}
}
