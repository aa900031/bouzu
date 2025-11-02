export function isObject(
	val: unknown,
): val is Record<PropertyKey, any> {
	return Object.prototype.toString.call(val) === '[object Object]'
}

export const isClient = typeof window !== 'undefined' && typeof document !== 'undefined'
