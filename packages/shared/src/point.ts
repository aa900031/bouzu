export interface Point {
	x: number
	y: number
}

export function createPoint(
	x = 0,
	y = 0,
): Point {
	return { x, y }
}

export function checkPointOrigin(p: Point): boolean {
	return p.x === 0 && p.y === 0
}

export function checkPointEqual(a: Point,	b: Point): boolean {
	return a.x === b.x
  && a.y === b.y
}
