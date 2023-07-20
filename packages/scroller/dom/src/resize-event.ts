import { ownerWindow } from 'dom-helpers'

export function onResizeEvent(handler: () => void) {
	const win = ownerWindow()
	win.addEventListener('resize', handler)
	return () => win.removeEventListener('resize', handler)
}
