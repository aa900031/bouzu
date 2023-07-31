export function isObject(
	val: unknown,
): val is Record<PropertyKey, any> {
	return Object.prototype.toString.call(val) === '[object Object]'
}
