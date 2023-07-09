import { type Ref, computed, ref, shallowRef, triggerRef, watchEffect } from 'vue-demi'
import { noop } from '@bouzu/shared'

export type FnHandler<TArgs extends any[]> = (...args: TArgs) => void

export type FnUnregister = () => void

export type FnGetter<T, TArgs extends any[]> = (
	...args: Partial<TArgs>
) => T

export type FnSetter<T> = (val: T) => void

export type FnStopEvent = () => void

export type EventRef<T> = [Ref<T>, FnStopEvent]

export function eventRef<
	T,
	THandler extends (...args: any[]) => void = () => void,
>(
	opts: {
		register: (handler: THandler) => FnUnregister
		get: FnGetter<T, Parameters<THandler>>
		set?: FnSetter<T>
		lazy?: boolean
	},
): EventRef<T> {
	let cleanup = noop
	let handlerArgs: Parameters<THandler> = [] as any
	let hasCleaned = false
	const started = ref(!opts.lazy)
	const changed = shallowRef()
	const targetRef = shallowRef() as Ref<T>

	const handler = ((..._args: Parameters<THandler>) => {
		handlerArgs = _args
		triggerRef(changed)
	}) as THandler

	const stopRegisterWatch = watchEffect((onCleanup) => {
		if (!started.value)
			return

		const unregister = opts.register(handler)

		cleanup = () => {
			unregister()
			handlerArgs = [] as any
			cleanup = noop
		}

		onCleanup(() => {
			hasCleaned = cleanup !== noop
			cleanup()
		})

		if (hasCleaned)
			Promise.resolve().then(() => triggerRef(changed))
	}, { flush: 'sync' })

	const stopGetterWatch = watchEffect(() => {
		if (!started.value)
			return

		// eslint-disable-next-line no-unused-expressions
		changed.value
		targetRef.value = opts.get(...handlerArgs)
	}, { flush: 'sync' })

	const stop = () => {
		stopGetterWatch()
		stopRegisterWatch()
		cleanup()
	}

	return [
		computed({
			get: opts.lazy
				? () => {
						started.value = true
						return targetRef.value
					}
				: () => targetRef.value,
			set: opts.set ?? noop,
		}),
		stop,
	]
}
