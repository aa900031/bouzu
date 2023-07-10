function keyDiff<T>(a: Map<T, any>, b: Map<T, any>): Set<T> {
	const res = new Set<T>()

	for (const key of a.keys()) {
		if (!b.has(key))
			res.add(key)
	}

	return res
}

export function differenceMap<T>(a: Map<T, any>, b: Map<T, any>) {
	const toRemove = keyDiff(a, b)
	const toAdd = keyDiff(b, a)
	const toUpdate = new Set<T>()
	for (const key of a.keys()) {
		if (b.has(key))
			toUpdate.add(key)
	}
	return { toRemove, toAdd, toUpdate }
}
