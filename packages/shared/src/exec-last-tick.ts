/* eslint-disable prefer-spread */
type WithoutFirstParameter<T> = T extends (arg1: any, ...args: infer U) => any ? U : any

export function execLastTick<
  TTickFn extends typeof setTimeout | typeof queueMicrotask | typeof requestAnimationFrame,
  TFn extends (...args: any) => any,
>(
	tickFn: TTickFn,
	fn: TFn,
	...tickFnArgs: WithoutFirstParameter<TTickFn>
): (...args: Parameters<TFn>) => void {
	let taskId = 0
	let lastArgs: Parameters<TFn> | undefined

	return (...fnArgs: Parameters<TFn>) => {
		lastArgs = fnArgs
		taskId++
		const currId = taskId

    ;(tickFn as any)(
			() => {
				if (currId !== taskId)
					return
				fn.apply(null, lastArgs ?? [])
			},
			...tickFnArgs,
		)
	}
}
