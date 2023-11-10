import type { Rect, RectCornerValue, Point } from '@bouzu/shared'
import type { Layout } from './layouts'

export interface ScrollAnchor {
	layout: Layout
	corner: RectCornerValue
	offset: Point
}

export type FnGetScrollAnchor = (rect: Rect) => string
