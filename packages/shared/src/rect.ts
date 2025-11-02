import type { ValueOf } from 'type-fest'
import type { Point } from './point'
import type { Size } from './size'
import { createPoint } from './point'
import { createSize } from './size'

export type Rect = Size & Point

export const RectCorner = {
	TopLeft: 'TopLeft',
	TopRight: 'TopRight',
	BottomLeft: 'BottomLeft',
	BottomRight: 'BottomRight',
} as const

export type RectCornerValue = ValueOf<typeof RectCorner>

export function createRect(
	x = 0,
	y = 0,
	width = 0,
	height = 0,
): Rect {
	return {
		...createPoint(x, y),
		...createSize(width, height),
	}
}

export function cloneRect(rect: Rect): Rect {
	return createRect(rect.x, rect.y, rect.width, rect.height)
}

export function getRectMaxX(rect: Rect) {
	return rect.x + rect.width
}

export function getRectMaxY(rect: Rect) {
	return rect.y + rect.height
}

export function getRectArea(rect: Rect) {
	return rect.width * rect.height
}

export function getRectTopLeft(rect: Rect) {
	return createPoint(rect.x, rect.y)
}

export function getRectTopRight(rect: Rect) {
	return createPoint(getRectMaxX(rect), rect.y)
}

export function getRectBottomLeft(rect: Rect) {
	return createPoint(rect.x, getRectMaxY(rect))
}

export function getRectBottomRight(rect: Rect) {
	return createPoint(getRectMaxX(rect), getRectMaxY(rect))
}

export function getRectPointByRectCorner(
	rect: Rect,
	corner: RectCornerValue,
) {
	switch (corner) {
		case RectCorner.TopLeft:
			return getRectTopLeft(rect)
		case RectCorner.TopRight:
			return getRectTopRight(rect)
		case RectCorner.BottomLeft:
			return getRectBottomLeft(rect)
		case RectCorner.BottomRight:
			return getRectBottomRight(rect)
		default:
			throw new TypeError(`Not match corner: ${corner}`)
	}
}

export function checkRectIntersectsX(
	a: Rect,
	b: Rect,
): boolean {
	return a.x <= getRectMaxX(b)
		&& b.x <= getRectMaxX(a)
}

export function checkRectIntersectsY(
	a: Rect,
	b: Rect,
): boolean {
	return a.y <= getRectMaxY(b)
		&& b.y <= getRectMaxY(a)
}

export function checkRectIntersects(
	a: Rect,
	b: Rect,
): boolean {
	return checkRectIntersectsX(a, b)
		&& checkRectIntersectsY(a, b)
}

export function checkRectContains(
	a: Rect,
	b: Rect,
): boolean {
	return a.x <= b.x
		&& a.y <= b.y
		&& getRectMaxX(a) >= getRectMaxX(b)
		&& getRectMaxY(a) >= getRectMaxY(b)
}

export function checkRectContainsPoint(
	a: Rect,
	p: Point,
): boolean {
	return a.x <= p.x
		&& a.y <= p.y
		&& getRectMaxX(a) >= p.x
		&& getRectMaxY(a) >= p.y
}

export function getRectCornerInOther(
	a: Rect,
	b: Rect,
): RectCornerValue | null {
	for (const key in RectCorner) {
		const point = getRectPointByRectCorner(a, RectCorner[key as keyof typeof RectCorner])
		if (checkRectContainsPoint(b, point))
			return RectCorner[key as keyof typeof RectCorner]
	}
	return null
}

export function checkRectEqual(
	a: Rect,
	b: Rect,
): boolean {
	return a.x === b.x
		&& a.y === b.y
		&& a.width === b.width
		&& a.height === b.height
}

export function checkRectEqualPoint(
	r: Rect,
	p: Point | Rect,
): boolean {
	return r.x === p.x
		&& r.y === p.y
}

export function checkRectEqualSize(
	r: Rect,
	s: Size | Rect,
): boolean {
	return r.width === s.width
		&& r.height === s.height
}

export function checkLayoutInvalidate(
	newRect: Rect,
	oldRect: Rect,
) {
	return newRect.width !== oldRect.width
		|| newRect.height !== oldRect.height
}

export function toSize(rect: Rect): Size {
	return createSize(rect.width, rect.height)
}

export function toPoint(rect: Rect): Point {
	return createPoint(rect.x, rect.y)
}
