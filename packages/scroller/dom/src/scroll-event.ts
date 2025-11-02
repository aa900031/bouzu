import type { TaggedEventHandler } from 'dom-helpers/addEventListener'
import { ownerDocument, ownerWindow } from 'dom-helpers'

export function onScrollEvent(
	el: HTMLElement,
	handler: TaggedEventHandler<'scroll'>,
	options?: boolean | AddEventListenerOptions,
): (() => void) {
	const target = ownerDocument(el).documentElement === el ? ownerWindow(el) : el
	target.addEventListener('scroll', handler, options)
	return () => target.removeEventListener('scroll', handler)
}
