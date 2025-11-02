import type { DirectionEventHandler, DirectionTypeValue, DirectionValue } from '@bouzu/scroller'
import type { Ref } from 'vue-demi'
import type { ScrollerContext } from './scroller'
import { createDirectionPlugin, Direction, DirectionEvent } from '@bouzu/scroller'
import { eventRef } from '@bouzu/vue-helper'
import { computedEager } from '@vueuse/core'
import { onScopeDispose, unref } from 'vue-demi'
import { useScrollerContext } from './scroller'

export interface ScrollDirection {
	value: Readonly<Ref<DirectionValue | null>>
	isUp: Readonly<Ref<boolean>>
	isDown: Readonly<Ref<boolean>>
	isLeft: Readonly<Ref<boolean>>
	isRight: Readonly<Ref<boolean>>
}

export function useScrollDirection(
	type?: DirectionTypeValue,
	context: ScrollerContext = useScrollerContext(),
): ScrollDirection {
	const direction = createDirectionPlugin(type)

	const [value] = eventRef<DirectionValue | null, DirectionEventHandler<typeof DirectionEvent.Change>>({
		register: (handler) => {
			direction.on(DirectionEvent.Change, handler)
			context.state.addPlugin(direction)
			return () => direction.off(DirectionEvent.Change, handler)
		},
		get: event => event?.value ?? direction.get(),
	})

	onScopeDispose(() => {
		direction.destroy(context.state)
	})

	return {
		value,
		isUp: computedEager(() => unref(value) === Direction.Up),
		isDown: computedEager(() => unref(value) === Direction.Down),
		isLeft: computedEager(() => unref(value) === Direction.Left),
		isRight: computedEager(() => unref(value) === Direction.Right),
	}
}
