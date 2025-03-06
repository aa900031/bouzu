import type { OverflowEventHandler } from '@bouzu/scroller'
import { OverflowEvent, createOverflowPlugin } from '@bouzu/scroller'
import { eventRef } from '@bouzu/vue-helper'
import type { Ref } from 'vue-demi'
import { onScopeDispose } from 'vue-demi'
import type { ScrollerContext } from './scroller'
import { useScrollerContext } from './scroller'

export interface ScrollOverflow {
	x: Readonly<Ref<boolean | undefined>>
	y: Readonly<Ref<boolean | undefined>>
}

export function useScrollOverflow(
	context: ScrollerContext = useScrollerContext(),
): ScrollOverflow {
	const overflow = createOverflowPlugin()

	const [x] = eventRef<boolean | undefined, OverflowEventHandler<typeof OverflowEvent.ChangeX>>({
		register: (handler) => {
			context.state.addPlugin(overflow)
			overflow.on(OverflowEvent.ChangeX, handler)
			return () => overflow.off(OverflowEvent.ChangeX, handler)
		},
		get: event => event?.value ?? overflow.getX(),
	})

	const [y] = eventRef<boolean | undefined, OverflowEventHandler<typeof OverflowEvent.ChangeY>>({
		register: (handler) => {
			context.state.addPlugin(overflow)
			overflow.on(OverflowEvent.ChangeY, handler)
			return () => overflow.off(OverflowEvent.ChangeY, handler)
		},
		get: event => event?.value ?? overflow.getX(),
	})

	onScopeDispose(() => {
		overflow.destroy(context.state)
	})

	return {
		x,
		y,
	}
}
