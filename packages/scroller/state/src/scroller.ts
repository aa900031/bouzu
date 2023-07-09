import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { Rect, Size } from '@bouzu/shared'
import { checkRectEqual, createSize, usePrevious } from '@bouzu/shared'
import type { ValueOf } from 'type-fest'

export const ScrollerEvent = {
	ChangeVisibleRect: 'change-visible-rect',
	ChangeContentSize: 'change-content-size',
} as const

export type ScrollerEventValue = ValueOf<typeof ScrollerEvent>

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Events = {
	[ScrollerEvent.ChangeVisibleRect]: {
		value: Rect
		oldValue: Rect | undefined
	}
	[ScrollerEvent.ChangeContentSize]: {
		value: Size
	}
}

export type ScrollerEventHandler<E extends ScrollerEventValue> = Handler<Events[E]>

export interface Scroller {
	on: Emitter<Events>['on']
	off: Emitter<Events>['off']

	destroy: () => void

	getVisibleRect: () => Rect | undefined
	setVisibleRect: (value: Rect) => void

	getContentSize: () => Size
	setContentSize: (value: Size) => void

	getPlugin: <TPlugin extends ScrollerPlugin>(name: string) => TPlugin | undefined
	addPlugin: (plugin: ScrollerPlugin) => boolean
	removePlugin: (plugin: ScrollerPlugin) => boolean
}

export interface ScrollerPlugin {
	name: string
	init: (scroller: Scroller) => void
	destroy: (scroller: Scroller) => void
}

export function createScroller(plugins: ScrollerPlugin[] = []): Scroller {
	type Self = Scroller

	const _plugins = new Map<string, ScrollerPlugin>()
	const _emitter = mitt<Events>()

	const [_visibleRect, _setVisibleRect] = usePrevious<Rect>()
	let _contentSize = createSize()

	const getVisibleRect: Self['getVisibleRect'] = () => {
		return _visibleRect.curr
	}

	const setVisibleRect: Self['setVisibleRect'] = (value) => {
		if (_visibleRect.curr && checkRectEqual(_visibleRect.curr, value))
			return
		_setVisibleRect(value)
		_emitter.emit(ScrollerEvent.ChangeVisibleRect, { value, oldValue: _visibleRect.prev })
	}

	const getContentSize: Self['getContentSize'] = () => {
		return _contentSize
	}

	const setContentSize: Self['setContentSize'] = (value) => {
		_contentSize = value
		_emitter.emit(ScrollerEvent.ChangeContentSize, { value })
	}

	const getPlugin: Self['getPlugin'] = (name) => {
		return _plugins.get(name) as any
	}

	const addPlugin: Self['addPlugin'] = (plugin) => {
		if (_plugins.has(plugin.name))
			return false

		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		plugin.init(self)
		_plugins.set(plugin.name, plugin)
		return true
	}

	const removePlugin: Self['removePlugin'] = (plugin) => {
		if (!_plugins.has(plugin.name))
			return false

		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		plugin.destroy(self)
		_plugins.delete(plugin.name)
		return true
	}

	const destroy: Self['destroy'] = () => {
		// eslint-disable-next-line @typescript-eslint/no-use-before-define
		_plugins.forEach(plugin => plugin.destroy(self))
		_emitter.all.clear()
	}

	const self: Self = {
		on: _emitter.on,
		off: _emitter.off,
		getVisibleRect,
		setVisibleRect,
		getContentSize,
		setContentSize,
		getPlugin,
		addPlugin,
		removePlugin,
		destroy,
	}

	for (const plugin of plugins)
		addPlugin(plugin)

	return self
}
