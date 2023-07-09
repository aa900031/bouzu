import type { Ref } from 'vue-demi'
import { unref } from 'vue-demi'
import { eventRef } from '@bouzu/vue-helper'
import { computedEager } from '@vueuse/core'
import type { DirectionEventHandler, DirectionTypeValue, DirectionValue } from '@bouzu/scroller'
import { Direction, DirectionEvent, createDirectionPlugin } from '@bouzu/scroller'
import type { ScrollerContext } from './scroller'
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
			context.addPlugin(direction)
			return () => direction.off(DirectionEvent.Change, handler)
		},
		get: event => event?.value ?? direction.get(),
	})

	return {
		value,
		isUp: computedEager(() => unref(value) === Direction.Up),
		isDown: computedEager(() => unref(value) === Direction.Down),
		isLeft: computedEager(() => unref(value) === Direction.Left),
		isRight: computedEager(() => unref(value) === Direction.Right),
	}
}
