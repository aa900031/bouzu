import type { ScrollerEventHandler, ScrollingEventHandler } from '@bouzu/scroller'
import type { Scroller } from '@bouzu/scroller-dom'
import type { Virtualizer as BaseVirtualizer, VirtualizerEventHandler, VirtualizerOptions } from '@bouzu/virtualizer'
import type { Simplify } from 'type-fest'
import { createScrollingPlugin, ScrollerEvent, ScrollingEvent } from '@bouzu/scroller'
import { createScroller } from '@bouzu/scroller-dom'
import { checkRectEqual, createRect, noop } from '@bouzu/shared'
import { createVirtualizer as createBaseVirtualizer, VirtualizerEvent } from '@bouzu/virtualizer'

export type CreateVirtualizerProps = Simplify<
	& VirtualizerOptions
>

export interface Virtualizer<T extends object> {
	state: BaseVirtualizer<T>
	scroller: Scroller
	mount: (el: HTMLElement) => void
	unmount: () => void
	destroy: () => void
}

export function createVirtualizer<T extends object>(
	props: CreateVirtualizerProps = {},
): Virtualizer<T> {
	const virtualizer = createBaseVirtualizer<T>(props)

	const scroller = createScroller()
	const scrolling = createScrollingPlugin(props.getTimeFn)
	scroller.setScrollEventPassive(true)
	scroller.setVisibleByContent(true)
	scroller.state.addPlugin(scrolling)

	let _unbindVirtualizerVisibleRectChange = noop
	const _bindVirtualizerVisibleRectChange = () => {
		_unbindVirtualizerVisibleRectChange()

		const handler: VirtualizerEventHandler<T, typeof VirtualizerEvent.ChangeVisibleRect> = ({
			value,
		}) => {
			if (checkRectEqual(value, scroller.state.getVisibleRect() ?? createRect()))
				return

			scroller.scrollTo(value)
		}

		virtualizer.on(VirtualizerEvent.ChangeVisibleRect, handler)
		_unbindVirtualizerVisibleRectChange = () => virtualizer.off(VirtualizerEvent.ChangeVisibleRect, handler)
	}

	let _unbindScrollerVisibleRectChange = noop
	const _bindScrollerVisibleRectChange = () => {
		_unbindScrollerVisibleRectChange()

		const handler: ScrollerEventHandler<typeof ScrollerEvent.ChangeVisibleRect> = ({
			value,
		}) => {
			if (checkRectEqual(value, virtualizer.getVisibleRect()))
				return
			virtualizer.setVisibleRect(value)
		}

		scroller.state.on(ScrollerEvent.ChangeVisibleRect, handler)
		_unbindScrollerVisibleRectChange = () => scroller.state.off(ScrollerEvent.ChangeVisibleRect, handler)
	}

	let _unbindIsScrolling = noop
	const _bindIsScrolling = () => {
		_unbindIsScrolling()

		const handler: ScrollingEventHandler<typeof ScrollingEvent.Change> = ({ value }) => {
			virtualizer.setIsScrolling(value)
		}

		scrolling.on(ScrollingEvent.Change, handler)
		_unbindIsScrolling = () => scrolling.off(ScrollingEvent.Change, handler)
	}

	const mount = (el: HTMLElement) => {
		scroller.mount(el)

		_bindIsScrolling()
		_bindScrollerVisibleRectChange()
		_bindVirtualizerVisibleRectChange()

		virtualizer.collect()
	}

	const unmount = () => {
		scroller.unmount()

		_unbindIsScrolling()
		_unbindScrollerVisibleRectChange()
		_unbindVirtualizerVisibleRectChange()
	}

	const destroy = () => {
		virtualizer.destroy()
		scroller.destroy()
		unmount()
	}

	return {
		state: virtualizer,
		scroller,
		mount,
		unmount,
		destroy,
	}
}
