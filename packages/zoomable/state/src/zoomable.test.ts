import { describe, expect, it, vi } from 'vitest'
import { Zoomable } from './zoomable'

function createZoomable() {
	return new Zoomable({
		getContainerBoundingClientRect: () => ({ x: 100, y: 50, width: 600, height: 400 }),
		getElementStyleSize: () => ({ width: 400, height: 300 }),
		min: 1,
		max: 3,
		animationDuration: 0,
	})
}

describe('zoomable focal point', () => {
	it('uses the cursor position relative to an offset container', () => {
		vi.useFakeTimers()
		const zoomable = createZoomable()

		for (let i = 0; i < 10; i++) {
			zoomable.handlers.Wheel({
				client: { x: 450, y: 250 },
				delta: { x: 0, y: -1 },
				withCtrl: true,
			})
		}
		vi.advanceTimersByTime(500)

		expect(zoomable.zoom).toBeCloseTo(2)
		expect(zoomable.pan.x).toBeCloseTo(-50)
		expect(zoomable.pan.y).toBe(0)
		vi.useRealTimers()
	})

	it('keeps scaled content constrained to the container boundary', () => {
		vi.useFakeTimers()
		const zoomable = createZoomable()

		for (let i = 0; i < 10; i++) {
			zoomable.handlers.Wheel({
				client: { x: 600, y: 250 },
				delta: { x: 0, y: -1 },
				withCtrl: true,
			})
		}
		vi.advanceTimersByTime(500)

		expect(zoomable.pan.x).toBeCloseTo(-100)
		vi.useRealTimers()
	})

	it('keeps the initial pinch point under a moving two-finger center', () => {
		const zoomable = createZoomable()

		zoomable.handlers.TouchStart({ touches: [
			{ client: { x: 300, y: 200 } },
			{ client: { x: 500, y: 200 } },
		] })
		zoomable.handlers.TouchMove({ touches: [
			{ client: { x: 250, y: 200 } },
			{ client: { x: 650, y: 200 } },
		] })

		expect(zoomable.zoom).toBe(2)
		expect(zoomable.pan).toEqual({ x: 50, y: 50 })
	})
})
