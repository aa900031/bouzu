import type { AffixAlignValues } from '@bouzu/affix'
import type { AxisValue } from '@bouzu/shared'
import type { MaybeRef } from '@vueuse/core'
import { AffixEvent as AffixStateEvent } from '@bouzu/affix'
import { Affix, AffixEvent } from '@bouzu/affix-dom'
import { eventRef } from '@bouzu/vue-helper'
import { markRaw, unref, watch } from 'vue-demi'

export interface UseAffixProps {
	target: MaybeRef<HTMLElement | null | undefined>
	container?: MaybeRef<HTMLElement | null | undefined>
	axis?: MaybeRef<AxisValue>
	align?: MaybeRef<AffixAlignValues>
}

export function useAffix(
	props: UseAffixProps,
) {
	const affix = markRaw(new Affix({
		axis: unref(props.axis),
		align: unref(props.align),
	}))

	const [fixed] = eventRef({
		register: (handler) => {
			affix.state.on(AffixStateEvent.ChangeFixed, handler)
			return () => affix.state.off(AffixStateEvent.ChangeFixed, handler)
		},
		get: () => affix.state.fixed,
	})
	const [targetStyle] = eventRef({
		register: (handler) => {
			affix.on(AffixEvent.ChangeTargetStyle, handler)
			return () => affix.off(AffixEvent.ChangeTargetStyle, handler)
		},
		get: () => affix.targetStyle,
	})
	const [contentStyle] = eventRef({
		register: (handler) => {
			affix.on(AffixEvent.ChangeContentStyle, handler)
			return () => affix.off(AffixEvent.ChangeContentStyle, handler)
		},
		get: () => affix.contentStyle,
	})

	watch(() => unref(props.align), (value) => {
		if (value == null)
			return
		affix.state.align = value
	}, { flush: 'sync' })
	watch(() => unref(props.axis), (value) => {
		if (value == null)
			return
		affix.state.axis = value
	}, { flush: 'sync' })

	watch(() => [
		unref(props.target),
		unref(props.container),
	] as const, ([
		target,
		container,
	]) => {
		if (target) {
			affix.mount(target, container ?? undefined)
		}
	}, { flush: 'post' })

	return {
		fixed,
		targetStyle,
		contentStyle,
	}
}
