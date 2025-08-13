export function executeTransition<T extends number | number[]>(
	source: Ref<T>,
	from: MaybeRefOrGetter<T>,
	to: MaybeRefOrGetter<T>,
	options: TransitionOptions = {},
): PromiseLike<void> {
	const {
		window = defaultWindow,
	} = options
	const fromVal = toValue(from)
	const toVal = toValue(to)
	const v1 = toVec(fromVal)
	const v2 = toVec(toVal)
	const duration = toValue(options.duration) ?? 1000
	const startedAt = Date.now()
	const endAt = Date.now() + duration
	const trans = typeof options.transition === 'function'
		? options.transition
		: (toValue(options.transition) ?? linear)

	const ease = typeof trans === 'function'
		? trans
		: createEasingFunction(trans)

	return new Promise<void>((resolve) => {
		source.value = fromVal

		const tick = () => {
			if (options.abort?.()) {
				resolve()

				return
			}

			const now = Date.now()
			const alpha = ease((now - startedAt) / duration)
			const arr = toVec(source.value).map((n, i) => lerp(v1[i], v2[i], alpha))

			if (Array.isArray(source.value))
				(source.value as number[]) = arr.map((n, i) => lerp(v1[i] ?? 0, v2[i] ?? 0, alpha))
			else if (typeof source.value === 'number')
				(source.value as number) = arr[0]

			if (now < endAt) {
				window?.requestAnimationFrame(tick)
			}
			else {
				source.value = toVal

				resolve()
			}
		}

		tick()
	})
}
