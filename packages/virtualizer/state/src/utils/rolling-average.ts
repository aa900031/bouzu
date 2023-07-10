export interface RollingAverage {
	add: (val: number) => void
	get: () => number
	reset: () => void
}

export function createRollingAverage(): RollingAverage {
	let _count = 0
	let _value = 0

	return {
		add: (val: number) => {
			_count++
			_value += (val - _value) / _count
		},
		get: () => _value,
		reset: () => {
			_count = 0
			_value = 0
		},
	}
}
