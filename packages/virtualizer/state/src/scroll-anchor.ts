import type { Rect, RectCorner } from '@bouzu/shared'
import type { Point } from '../../../shared/src/point'
import type { Layout } from './layouts'

export interface ScrollAnchor {
	layout: Layout
	corner: RectCorner
	offset: Point
}

export type FnGetScrollAnchor = (rect: Rect) => string
