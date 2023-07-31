import { computed, ref, shallowRef, triggerRef, watchEffect } from 'vue-demi'
import { isObject, noop } from '@bouzu/shared'
import type { Ref } from 'vue-demi'

type FnHandler = (...args: any[]) => void

type FnRegister<THandler extends FnHandler> = (
	handler: THandler
) => () => void

export interface EventRefAccessor<T, THandler extends FnHandler> {
	get: ((...args: Parameters<THandler>) => T) | (() => T)
	set: (val: T) => void
}

export interface EventRefProps<T, THandler extends FnHandler> extends EventRefOptions {
	register: FnRegister<THandler>
	get: EventRefAccessor<T, THandler>['get']
}

export interface WritableEventRefProps<T, THandler extends FnHandler> extends EventRefOptions, EventRefAccessor<T, THandler> {
	register: FnRegister<THandler>
}

export interface EventRefOptions {
	lazy?: boolean
}

export type WritableEventRef<T> = [Ref<T>, () => void]

export type EventRef<T> = [Ref<T> & { readonly value: T }, () => void]

export function eventRef<T, THandler extends FnHandler = () => void>(
	props: WritableEventRefProps<T, THandler>
): WritableEventRef<T>

export function eventRef<T, THandler extends FnHandler = () => void>(
	props: EventRefProps<T, THandler>
): EventRef<T>

export function eventRef<T, THandler extends FnHandler = () => void>(
	register: FnRegister<THandler>,
	getter: EventRefAccessor<T, THandler>,
	options?: EventRefOptions,
): WritableEventRef<T>

export function eventRef<T, THandler extends FnHandler = () => void>(
	register: FnRegister<THandler>,
	getter: EventRefAccessor<T, THandler>['get'],
	options?: EventRefOptions,
): EventRef<T>

export function eventRef<T, THandler extends FnHandler = () => void>(
	...args: any
): any {
	let register: FnRegister<THandler>
	let get: EventRefAccessor<T, THandler>['get']
	let set: EventRefAccessor<T, THandler>['set']
	let lazy: boolean

	if (isObject(args[0])) {
		const props = args[0] as EventRefProps<T, THandler>
		register = props.register
		get = props.get
		set = (props as WritableEventRefProps<T, THandler>).set ?? noop
		lazy = props.lazy ?? false
	}
	else {
		register = args[0]
		const modify = args[1]
		if (isObject(modify)) {
			get = (modify as EventRefAccessor<T, THandler>).get
			set = (modify as EventRefAccessor<T, THandler>).set
		}
		else {
			get = modify
			set = noop
		}
		const options = (args[2] ?? {}) as EventRefOptions
		lazy = options.lazy ?? false
	}

	let cleanup = noop
	let handlerArgs: Parameters<THandler> = [] as unknown as Parameters<THandler>
	let hasCleaned = false
	const started = ref(!lazy)
	const changed = shallowRef()
	const targetRef = shallowRef() as Ref<T>

	const handler = ((..._args: Parameters<THandler>) => {
		handlerArgs = _args
		triggerRef(changed)
	}) as THandler

	const stopRegisterWatch = watchEffect((onCleanup) => {
		if (!started.value)
			return

		const unregister = register(handler)

		cleanup = () => {
			unregister()
			handlerArgs = [] as unknown as Parameters<THandler>
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
		targetRef.value = get(...handlerArgs)
	}, { flush: 'sync' })

	const stop = () => {
		stopGetterWatch()
		stopRegisterWatch()
		cleanup()
	}

	return [
		computed({
			get: lazy
				? () => {
						started.value = true
						return targetRef.value
					}
				: () => targetRef.value,
			set: set ?? noop,
		}),
		stop,
	]
}
