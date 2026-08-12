import { describe, expect, it, vi } from 'vitest'
import { Zoomable, ZoomableEventName } from './zoomable'

function createZoomable(animationDuration = 0) {
	return new Zoomable({
		getContainerBoundingClientRect: () => ({ x: 100, y: 50, width: 600, height: 400 }),
		getElementStyleSize: () => ({ width: 400, height: 300 }),
		min: 1,
		max: 3,
		animationDuration,
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

describe('zoomable interaction events', () => {
	it('tracks programmatic transformations', () => {
		vi.useFakeTimers()
		const zoomable = createZoomable(100)
		const animatingStates: boolean[] = []
		const transformingStates: boolean[] = []
		zoomable.on(ZoomableEventName.ChangeIsAnimating, value => animatingStates.push(value))
		zoomable.on(ZoomableEventName.ChangeIsTransforming, value => transformingStates.push(value))

		zoomable.updateTo(2)
		expect(zoomable.isAnimating).toBe(true)
		expect(zoomable.isTransforming).toBe(true)
		vi.runAllTimers()

		expect(zoomable.isAnimating).toBe(false)
		expect(zoomable.isTransforming).toBe(false)
		expect(animatingStates).toEqual([true, false])
		expect(transformingStates).toEqual([true, false])
		vi.useRealTimers()
	})

	it('keeps animating true when a transition is replaced', () => {
		vi.useFakeTimers()
		const zoomable = createZoomable(100)
		const states: boolean[] = []
		zoomable.on(ZoomableEventName.ChangeIsAnimating, value => states.push(value))

		zoomable.updateTo(2)
		zoomable.updateTo(3)
		vi.runAllTimers()

		expect(states).toEqual([true, false])
		vi.useRealTimers()
	})

	it('tracks transforming while pan or zoom is active', () => {
		vi.useFakeTimers()
		const zoomable = createZoomable()
		const states: boolean[] = []
		const interactingStates: boolean[] = []
		zoomable.on(ZoomableEventName.ChangeIsTransforming, value => states.push(value))
		zoomable.on(ZoomableEventName.ChangeIsInteracting, value => interactingStates.push(value))

		expect(zoomable.isTransforming).toBe(false)
		expect(zoomable.isInteracting).toBe(false)
		for (let i = 0; i < 10; i++) {
			zoomable.handlers.Wheel({
				client: { x: 400, y: 250 },
				delta: { x: 0, y: -1 },
				withCtrl: true,
			})
		}
		expect(zoomable.isTransforming).toBe(true)
		zoomable.handlers.Wheel({
			client: { x: 400, y: 250 },
			delta: { x: 0, y: 1000 },
			withCtrl: false,
		})
		expect(zoomable.isPaning).toBe(true)
		expect(zoomable.isZooming).toBe(true)
		expect(zoomable.isInteracting).toBe(true)
		vi.advanceTimersByTime(150)

		expect(zoomable.isTransforming).toBe(false)
		expect(zoomable.isInteracting).toBe(false)
		expect(states).toEqual([true, false])
		expect(interactingStates).toEqual([true, false])
		vi.useRealTimers()
	})

	it('emits pan start and end for a drag', () => {
		const zoomable = createZoomable()
		const events: string[] = []
		const states: boolean[] = []
		zoomable.on(ZoomableEventName.ChangeIsPaning, value => states.push(value))
		zoomable.on(ZoomableEventName.PanStart, () => events.push(ZoomableEventName.PanStart))
		zoomable.on(ZoomableEventName.PanEnd, () => events.push(ZoomableEventName.PanEnd))

		expect(zoomable.isPaning).toBe(false)
		zoomable.handlers.MouseDown({ touches: [{ client: { x: 200, y: 100 } }] })
		zoomable.handlers.MouseMove({ touches: [{ client: { x: 220, y: 100 } }] })
		expect(zoomable.isPaning).toBe(true)
		zoomable.handlers.MouseUp({ touches: [{ client: { x: 220, y: 100 } }] })

		expect(zoomable.isPaning).toBe(false)
		expect(states).toEqual([true, false])
		expect(events).toEqual(['pan-start', 'pan-end'])
	})

	it('ends an active pan when pan is disabled', () => {
		const zoomable = createZoomable()
		const onEnd = vi.fn()
		zoomable.on(ZoomableEventName.PanEnd, onEnd)

		zoomable.handlers.MouseDown({ touches: [{ client: { x: 200, y: 100 } }] })
		zoomable.handlers.MouseMove({ touches: [{ client: { x: 220, y: 100 } }] })
		zoomable.enablePan = false

		expect(zoomable.isPaning).toBe(false)
		expect(onEnd).toHaveBeenCalledOnce()

		zoomable.handlers.MouseUp({ touches: [{ client: { x: 220, y: 100 } }] })
		expect(onEnd).toHaveBeenCalledOnce()
	})

	it('tracks wheel pan and zoom interactions', () => {
		vi.useFakeTimers()
		const zoomable = createZoomable()

		for (let i = 0; i < 10; i++) {
			zoomable.handlers.Wheel({
				client: { x: 400, y: 250 },
				delta: { x: 0, y: -1 },
				withCtrl: true,
			})
		}
		expect(zoomable.isZooming).toBe(true)
		vi.advanceTimersByTime(150)
		expect(zoomable.isZooming).toBe(false)

		zoomable.handlers.Wheel({
			client: { x: 400, y: 250 },
			delta: { x: 0, y: 1000 },
			withCtrl: false,
		})
		expect(zoomable.isPaning).toBe(true)

		zoomable.handlers.Wheel({
			client: { x: 400, y: 250 },
			delta: { x: 0, y: 1000 },
			withCtrl: false,
		})
		expect(zoomable.isPaning).toBe(false)
		vi.useRealTimers()
	})

	it('emits zoom start and end for a pinch', () => {
		const zoomable = createZoomable()
		const events: string[] = []
		const states: boolean[] = []
		zoomable.on(ZoomableEventName.ChangeIsZooming, value => states.push(value))
		zoomable.on(ZoomableEventName.ZoomStart, () => events.push(ZoomableEventName.ZoomStart))
		zoomable.on(ZoomableEventName.ZoomEnd, () => events.push(ZoomableEventName.ZoomEnd))

		expect(zoomable.isZooming).toBe(false)
		zoomable.handlers.TouchStart({ touches: [
			{ client: { x: 200, y: 100 } },
			{ client: { x: 300, y: 100 } },
		] })
		zoomable.handlers.TouchMove({ touches: [
			{ client: { x: 190, y: 100 } },
			{ client: { x: 310, y: 100 } },
		] })
		expect(zoomable.isZooming).toBe(true)
		zoomable.handlers.TouchEnd({ touches: [] })

		expect(zoomable.isZooming).toBe(false)
		expect(states).toEqual([true, false])
		expect(events).toEqual(['zoom-start', 'zoom-end'])
	})
})
