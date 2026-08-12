import { expect, it, vi } from 'vitest'
import { Kinetic } from './kinetic'

it('runs after release and reports cancellation once', () => {
	vi.useFakeTimers()
	let point = { x: 0, y: 0 }
	let callback: ((time: number) => void) | undefined
	const onCancelled = vi.fn()
	const kinetic = new Kinetic({
		getPoint: () => point,
		getBounds: value => value,
		onUpdate: () => {},
		onCancelled,
		rafFn: (handler) => {
			callback = handler
			return 1
		},
		cafFn: () => {},
	})

	expect(kinetic.isRunning).toBe(false)
	kinetic.start()
	point = { x: 10, y: 0 }
	vi.advanceTimersByTime(16)
	callback?.(16)
	kinetic.stop()

	expect(kinetic.isRunning).toBe(true)
	kinetic.cancel()
	kinetic.cancel()

	expect(kinetic.isRunning).toBe(false)
	expect(onCancelled).toHaveBeenCalledOnce()
	vi.useRealTimers()
})
