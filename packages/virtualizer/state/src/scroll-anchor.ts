import type { Point, Rect, RectCornerValue } from '@bouzu/shared'
import type { Layout } from './layouts'

export interface ScrollAnchor {
	layout: Layout
	corner: RectCornerValue
	offset: Point
}

export type FnGetScrollAnchor = (rect: Rect) => string
