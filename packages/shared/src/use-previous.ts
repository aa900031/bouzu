export type Previous<T> = [
	{
		readonly curr: T | undefined
		readonly prev: T | undefined
	},
	(val: T) => void,
]

export function usePrevious<T>(val?: T): Previous<T> {
	const value: Previous<T>[0] = {
		curr: val,
		prev: val,
	}
	Object.defineProperty(value, 'curr', { writable: false })
	Object.defineProperty(value, 'prev', { writable: false })

	return [
		value,
		(nextValue) => {
			Object.defineProperty(value, 'prev', { value: value.curr, writable: false })
			Object.defineProperty(value, 'curr', { value: nextValue, writable: false })
		},
	]
}
