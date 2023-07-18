import type { Rect, Size } from '@bouzu/shared'

export interface Layout {
	key: string
	rect: Rect
	estimated: boolean
}

let keySeed = 0

export function createLayout(rect: Rect): Layout {
	return {
		key: `layout-${keySeed += 1}`,
		rect,
		estimated: true,
	}
}

export interface ReloadContext {
	dataChanged?: boolean
	offsetChanged?: boolean
	sizeChanged?: boolean
}

export function mergeReloadContext(
	a: ReloadContext,
	b: ReloadContext,
): ReloadContext {
	return {
		...a, ...b,
	}
}

export interface Layouts<T> {
	reload: (data: T[], visibleRect: Rect, context: ReloadContext) => void
	getItem: (item: T) => Layout | undefined
	updateItemSize: (item: T, size: Size) => boolean
	getVisibleItems: (rect: Rect) => { index: number; layout: Layout }[]
	getContentSize: () => Size
}
