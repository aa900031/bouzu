import { scrollLeft as getScrollLeft, scrollTop as getScrollTop } from 'dom-helpers'
import type { Rect } from '@bouzu/shared'
import { createRect } from '@bouzu/shared'

export function getVisibleRect(el: HTMLElement): Rect {
	return createRect(
		getScrollLeft(el),
		getScrollTop(el),
		el.clientWidth,
		el.clientHeight,
	)
}
