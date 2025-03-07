import { ownerWindow } from 'dom-helpers'

export function onWindowResizeEvent(handler: () => void) {
	const win = ownerWindow()
	win.addEventListener('resize', handler)
	return () => win.removeEventListener('resize', handler)
}

export function onElementResizeEvent(
	el: HTMLElement,
	handler: (entry: ResizeObserverEntry) => void,
): () => void {
	const observer = new ResizeObserver(([entry]) => {
		handler(entry)
	})
	observer.observe(el)

	return () => {
		observer.unobserve(el)
		observer.disconnect()
	}
}
