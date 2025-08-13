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

export function checkPointEqualWithTolerance(
	a: Point,
	b: Point,
	tolerance: number = 0.01,
): boolean {
	return Math.abs(a.x - b.x) < tolerance
		&& Math.abs(a.y - b.y) < tolerance
}

export function updatePoint(dest: Point, src: Point): void {
	dest.x = src.x
	dest.y = src.y
}

export function getPointCenter(
	p1: Point,
	p2: Point,
): Point {
	return createPoint(
		(p1.x + p2.x) / 2,
		(p1.y + p2.y) / 2,
	)
}

export function getPointDistance(
	p1: Point,
	p2: Point,
): number {
	const dx = p1.x - p2.x
	const dy = p1.y - p2.y
	return Math.sqrt(dx * dx + dy * dy)
}

export function clonePoint(
	a: Point,
): Point {
	return createPoint(a.x, a.y)
}
