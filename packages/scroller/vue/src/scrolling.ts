import type { ScrollingEventHandler } from '@bouzu/scroller'
import type { Ref } from 'vue-demi'
import type { ScrollerContext } from './scroller'
import { createScrollingPlugin, ScrollingEvent } from '@bouzu/scroller'
import { eventRef } from '@bouzu/vue-helper'
import { useScrollerContext } from './scroller'

export interface Scrolling {
	value: Ref<boolean>
}

export function useScrolling(
	context: ScrollerContext = useScrollerContext(),
): Scrolling {
	const scrolling = createScrollingPlugin()

	const [value] = eventRef<boolean, ScrollingEventHandler<typeof ScrollingEvent.Change>>({
		register: (handler) => {
			scrolling.on(ScrollingEvent.Change, handler)
			context.state.addPlugin(scrolling)
			return () => scrolling.off(ScrollingEvent.Change, handler)
		},
		get: event => event?.value ?? scrolling.get(),
	})

	return {
		value,
	}
}
