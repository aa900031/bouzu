import type { Affix as BaseAffix, CreateAffixProps as CreateBaseAffixProps } from '@bouzu/affix'
import { createAffix as createBaseAffix } from '@bouzu/affix'
import { createScroller } from '@bouzu/scroller-dom'

export interface Affix {
	mount: (el: HTMLElement) => void
	unmount: () => void
	destroy: () => void
	detect: () => void
	getTargetElement: () => HTMLElement | undefined
	getContainerElement: () => HTMLElement | undefined
	getScrollElement: () => HTMLElement | undefined
	setPosition: BaseAffix['setPosition']
}

export interface CreateAffixProps extends CreateBaseAffixProps {

}

export function createAffix(
	props?: CreateAffixProps,
): Affix {
	const scroller = createScroller()
	scroller.setVisibleByContent(true)
	scroller.setScrollEventPassive(true)

	const state = createBaseAffix(props)
	let _target: HTMLElement | undefined
	let _container: HTMLElement | undefined

	return {
		mount,
		unmount,
	}

	function mount(
		target: HTMLElement,
		container?: HTMLElement,
	) {
		_target = target
		_container = container
	}

	function unmount() {
		_target = undefined
		_container = undefined
	}
}
