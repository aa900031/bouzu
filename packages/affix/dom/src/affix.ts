import type { AffixOptions } from '@bouzu/affix'
import type { Emitter } from 'mitt'
import { Affix as AffixState, AffixEvent as AffixStateEvent } from '@bouzu/affix'
import { createRect, createSize } from '@bouzu/shared'
import { shallowEqual } from 'fast-equals'
import mitt from 'mitt'

export const AffixEvent = {
	ChangeTargetStyle: 'change-target-style',
	ChangeContentStyle: 'change-content-style',
} as const

export interface AffixProps extends AffixOptions {}

// eslint-disable-next-line ts/consistent-type-definitions
type Events = {
	[AffixEvent.ChangeTargetStyle]: {
		value: Record<string, string | undefined> | undefined
	}
	[AffixEvent.ChangeContentStyle]: {
		value: Record<string, string | undefined> | undefined
	}
}

export class Affix {
	#emitter: Emitter<Events> = mitt<Events>()
	state: AffixState

	#targetElement: HTMLElement | undefined
	#containerElement: HTMLElement | undefined

	#unbindState: (() => void) | undefined
	#unbindWindowSize: (() => void) | undefined
	#unbindTargetRect: (() => void) | undefined
	#unbindContainerRect: (() => void) | undefined

	#targetStyle: Record<string, string | undefined> | undefined
	#contentStyle: Record<string, string | undefined> | undefined

	#isResizing = false

	on = this.#emitter.on
	off = this.#emitter.off

	constructor(
		props?: AffixProps,
	) {
		this.state = new AffixState(props)
		this.#unbindState = this.#bindState()
	}

	#bindTargetRect() {
		this.#unbindTargetRect?.()

		if (!this.#targetElement)
			return

		const handler = this.#updateTargetRect.bind(this)
		const handlerForWindowResize = this.#handleWindowResizeForTargetElement.bind(this)

		const observer = new ResizeObserver(handler)
		observer.observe(this.#targetElement)

		const observer2 = new MutationObserver(handler)
		observer2.observe(this.#targetElement, {
			attributeFilter: ['style', 'class'],
		})

		window.addEventListener('resize', handlerForWindowResize, { passive: true })
		window.addEventListener('scroll', handler, { capture: true, passive: true })

		return () => {
			observer.disconnect()
			observer2.disconnect()
			window.removeEventListener('resize', handlerForWindowResize)
			window.removeEventListener('scroll', handler)
		}
	}

	#updateTargetRect() {
		if (!this.#targetElement)
			return

		const rect = this.#targetElement.getBoundingClientRect()
		this.state.targetBoundingRect = createRect(
			rect.x,
			rect.y,
			rect.width,
			rect.height,
		)
	}

	async #handleWindowResizeForTargetElement() {
		if (this.#isResizing)
			return

		if (!this.state.fixed) {
			this.#updateTargetRect()
		}
		else {
			this.#isResizing = true
			this.state.fixed = false
			await new Promise(resolve => window.requestAnimationFrame(resolve))
			this.#updateTargetRect()
			this.state.fixed = true
			this.#isResizing = false
		}
	}

	#bindWindowSize() {
		this.#unbindWindowSize?.()

		const handler = this.#updateWindowSize.bind(this)

		window.addEventListener('resize', handler, { passive: true })

		const mediaQuery = window.matchMedia('(orientation: portrait)')
		mediaQuery.addEventListener('change', handler, { passive: true })

		return () => {
			window.removeEventListener('resize', handler)
			mediaQuery.removeEventListener('change', handler)
		}
	}

	#updateWindowSize() {
		this.state.windowSize = createSize(
			window.innerWidth,
			window.innerHeight,
		)
	}

	#bindContainerRect() {
		this.#unbindContainerRect?.()

		if (!this.#containerElement)
			return

		const handler = this.#updateContainerRect.bind(this)

		const observer = new ResizeObserver(handler)
		observer.observe(this.#containerElement)

		const observer2 = new MutationObserver(handler)
		observer2.observe(this.#containerElement, {
			attributeFilter: ['style', 'class'],
		})

		window.addEventListener('resize', handler, { passive: true })
		window.addEventListener('scroll', handler, { capture: true, passive: true })

		return () => {
			observer.disconnect()
			observer2.disconnect()
			window.removeEventListener('resize', handler)
			window.removeEventListener('scroll', handler)
		}
	}

	#updateContainerRect() {
		if (!this.#containerElement)
			return

		const rect = this.#containerElement.getBoundingClientRect()
		this.state.containerBoundingRect = createRect(
			rect.x,
			rect.y,
			rect.width,
			rect.height,
		)
	}

	#bindState() {
		this.#unbindState?.()

		const handler = this.update.bind(this)
		this.state.on(AffixStateEvent.ChangeFixed, handler)
		this.state.on(AffixStateEvent.ChangeDifference, handler)

		return () => {
			this.state.off(AffixStateEvent.ChangeFixed, handler)
			this.state.off(AffixStateEvent.ChangeDifference, handler)
		}
	}

	#updateTargetStyle(
		value: Record<string, string | undefined> | undefined,
	) {
		if (shallowEqual(this.#targetStyle, value))
			return
		this.#targetStyle = value
		this.#emitter.emit(AffixEvent.ChangeTargetStyle, { value: this.#targetStyle })
	}

	#updateContentStyle(
		value: Record<string, string | undefined> | undefined,
	) {
		if (shallowEqual(this.#contentStyle, value))
			return
		this.#contentStyle = value
		this.#emitter.emit(AffixEvent.ChangeContentStyle, { value: this.#contentStyle })
	}

	update() {
		this.#updateTargetStyle(
			this.state.fixed
				? {
						height: `${this.state.targetBoundingRect.height}px`,
						width: `${this.state.targetBoundingRect.width}px`,
					}
				: undefined,
		)
		this.#updateContentStyle(
			this.state.fixed
				? {
						position: 'fixed',
						height: `${this.state.targetBoundingRect.height}px`,
						width: `${this.state.targetBoundingRect.width}px`,
						top: this.state.align === 'start' && this.state.axis === 'y' ? '0' : undefined,
						bottom: this.state.align === 'end' && this.state.axis === 'y' ? '0' : undefined,
						left: this.state.align === 'start' && this.state.axis === 'x' ? '0' : undefined,
						right: this.state.align === 'end' && this.state.axis === 'x' ? '0' : undefined,
						transform: this.state.difference ? `translate(${this.state.difference.x}px, ${this.state.difference.y}px)` : undefined,
					}
				: undefined,
		)
	}

	public mount(
		el: HTMLElement,
		container?: HTMLElement,
	) {
		this.#targetElement = el
		this.#containerElement = container

		this.state.disabled = true

		this.#unbindWindowSize = this.#bindWindowSize()
		this.#unbindTargetRect = this.#bindTargetRect()
		this.#unbindContainerRect = this.#bindContainerRect()

		this.#updateTargetRect()
		this.#updateWindowSize()
		this.#updateContainerRect()

		this.state.disabled = false

		this.state.update()
		this.update()
	}

	public unmount() {
		this.#unbindWindowSize?.()
		this.#unbindTargetRect?.()
		this.#unbindContainerRect?.()

		this.#targetElement = undefined
		this.#containerElement = undefined
	}

	public destroy() {
		this.#emitter.all.clear()
		this.state.destroy()
		this.#unbindState?.()
		this.unmount()
	}

	public get targetStyle() {
		return this.#targetStyle
	}

	public get contentStyle() {
		return this.#contentStyle
	}
}
