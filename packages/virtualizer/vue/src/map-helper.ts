export function getValueOrCreate<
	TKey extends object,
	TValue,
>(
	store: WeakMap<TKey, TValue>,
	key: TKey,
	create: () => TValue,
): TValue {
	const cache = store.get(key)
	if (cache) {
		store.set(key, cache)
		return cache
	}

	const value = create()
	store.set(key, value)

	return value
}
