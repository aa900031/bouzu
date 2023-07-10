import type { Point } from '@bouzu/shared'
import { createPoint, noop } from '@bouzu/shared'
import { registerRaf } from './utils/raf'
import type { GetTimeFn } from './utils/time'
import { getTime as defaultGetTime } from './utils/time'

let fixTs: boolean

export type Animation = Promise<void> & {
	cancel: () => void
}

export type EaseFn = (t: number) => number

export function createAnimation(
	begin: Point,
	end: Point,
	duration: number,
	easeFn: EaseFn,
	updateOffset: (offset: Point) => void | boolean,
	getTime: GetTimeFn = defaultGetTime,
): Animation {
	let canceled = false
	let cancelRaf = noop

	const promise = new Promise<void>((resolve) => {
		const start = getTime()
		const diffX = end.x - begin.x
		const diffY = end.y - begin.y

		const run = (t: number) => {
			if (fixTs == null) {
				// eslint-disable-next-line no-mixed-operators
				fixTs = t > 1e12 !== getTime() > 1e12
			}

			if (fixTs)
				t = getTime()

			// check if we're done
			const delta = t - start
			if (delta > duration) {
				updateOffset(end)
				resolve()
			}
			else {
				// call frame callback after computing eased time and get the next frame
				const proceed = updateOffset(createPoint(
					begin.x + diffX * easeFn(delta / duration),
					begin.y + diffY * easeFn(delta / duration),
				))

				if (proceed !== false && !canceled)
					cancelRaf = registerRaf(run)
			}
		}

		cancelRaf = registerRaf(run)
	}) as Animation

	promise.cancel = () => {
		canceled = true
		cancelRaf()
	}

	return promise
}

export function createNoopAnimation(): Animation {
	const promise = (new Promise<void>(resolve => resolve())) as Animation
	promise.cancel = noop
	return promise
}

export const easeLinear: EaseFn = t => t

export const easeOut: EaseFn = t => Math.sin(t * Math.PI / 2)
