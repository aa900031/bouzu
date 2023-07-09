import type { Rect } from '@bouzu/shared'
import { createRect } from '@bouzu/shared'

export function getOffsetRect(
	el: HTMLElement,
	rootEl?: HTMLElement,
): Rect {
	return createRect(
		el.offsetLeft - (rootEl?.offsetLeft ?? 0),
		el.offsetTop - (rootEl?.offsetTop ?? 0),
		el.offsetWidth,
		el.offsetHeight,
	)
}
