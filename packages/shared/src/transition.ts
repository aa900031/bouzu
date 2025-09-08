import { noop } from './noop'
import { type RegisterRafMethods, registerRaf } from './raf'
import type { GetTimeFn } from './time'
import { getTime as defaultGetTime } from './time'

export interface RunTransitionOptions {
	start: number
	end: number
	onUpdate: (value: number) => void | boolean
	easing?: EaseFn
	duration?: number
	onStarted?: () => void
	onFinished?: () => void
	getTime?: GetTimeFn
	raf?: RegisterRafMethods['raf']
	caf?: RegisterRafMethods['caf']
}

export type TransitionRunner = Promise<void> & {
	cancel: () => void
}

export function runTransition(
	options: RunTransitionOptions,
): TransitionRunner {
	const {
		start,
		end,
		onUpdate,
		onStarted,
		onFinished,
		raf = window.requestAnimationFrame,
		caf = window.cancelAnimationFrame,
		duration = 1000,
		// eslint-disable-next-line ts/no-use-before-define
		easing = easeLinear,
		getTime = defaultGetTime,
	} = options
	const rafMethos: RegisterRafMethods = { raf, caf }

	let _cancelRaf = noop
	let _resolve = noop
	let _canceled = false

	const promise = new Promise<void>((resolve) => {
		_resolve = resolve
		const startAt = getTime()
		onStarted?.()

		const tick = (currentTime: number) => {
			if (_canceled) {
				resolve()
				return
			}

			const elapsed = currentTime - startAt
			const progress = Math.min(elapsed / duration, 1)

			const value = start + (end - start) * easing(progress)
			onUpdate(value)

			if (progress < 1) {
				_cancelRaf = registerRaf(tick, rafMethos)
			}
			else {
				onFinished?.()
				resolve()
			}
		}

		_cancelRaf = registerRaf(tick, rafMethos)
	}) as TransitionRunner

	promise.cancel = () => {
		_canceled = true
		_cancelRaf()
		_resolve()
	}

	return promise
}

export function runNoopTransition(): TransitionRunner {
	const promise = (new Promise<void>(resolve => resolve())) as TransitionRunner
	promise.cancel = noop
	return promise
}

export type EaseFn = (t: number) => number

export const easeLinear: EaseFn = t => t

export const easeOut: EaseFn = t => Math.sin(t * Math.PI / 2)

export const easeOutCubic: EaseFn = t => 1 - (1 - t) ** 3
