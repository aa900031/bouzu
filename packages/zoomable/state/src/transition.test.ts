import { runTransition } from '@bouzu/shared'
import { expect, it, vi } from 'vitest'

it('reports a transition cancellation once', () => {
	let tick: ((time: number) => void) | undefined
	const onCancelled = vi.fn()
	const transition = runTransition({
		start: 0,
		end: 1,
		onUpdate: () => {},
		onCancelled,
		raf: (callback) => {
			tick = callback
			return 1
		},
		caf: () => {},
	})

	transition.cancel()
	transition.cancel()

	expect(tick).toBeDefined()
	expect(onCancelled).toHaveBeenCalledOnce()
})
