import type { Animation } from './animation'
import { noop } from './noop'
import { type RegisterRafMethods, registerRaf } from './raf'
import type { GetTimeFn } from './time'

export interface AnimationOptions {
	start: number
	end: number
	duration: number
	easing: (t: number) => number
	onUpdate: (value: number) => void | boolean
	onComplete?: () => void
	getTime?: GetTimeFn
	raf?: RegisterRafMethods['raf']
	caf?: RegisterRafMethods['caf']
}

let fixTs: boolean

export function createAnimation(
	options: AnimationOptions,
): Animation {
	let canceled = false
	const cancelRaf = noop

	promise.cancel = () => {
		canceled = true
		cancelRaf()
	}

	return promise
}
