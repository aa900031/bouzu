import { scrollParent } from 'dom-helpers'
import isDocument from 'dom-helpers/isDocument'

function isWindow(val: any): val is Window {
	return typeof window !== 'undefined' && Object.prototype.toString.call(val) === '[object Window]'
}

export function getScrollParent(
	el: HTMLElement,
	firstPassible?: boolean,
): HTMLElement {
	const target = scrollParent(el, firstPassible)
	if (isWindow(target))
		return target.document.documentElement
	else if (isDocument(target))
		return target.documentElement
	else
		return target
}
