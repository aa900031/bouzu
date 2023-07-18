import type { Layout } from './layouts'

export interface View<T> {
	key: string
	index: number
	data: T
	layout: Layout
}

export interface ReuseView {
	key: string
	index: null
	data: null
	layout: null
}

let keySeed = 0

export function createView<T>(
	index: number,
	data: T,
	layout: Layout,
): View<T> {
	return {
		key: `view-${keySeed += 1}`,
		index,
		data,
		layout,
	}
}

export function toView<T>(
	reuseView: ReuseView,
	index: number,
	data: T,
	layout: Layout,
): View<T> {
	(reuseView as unknown as View<T>).index = index
	;(reuseView as unknown as View<T>).data = data
	;(reuseView as unknown as View<T>).layout = layout
	return reuseView as unknown as View<T>
}

export function toReuseView<T>(view: View<T>): ReuseView {
	(view as unknown as ReuseView).index = null
	;(view as unknown as ReuseView).data = null
	;(view as unknown as ReuseView).layout = null
	return view as unknown as ReuseView
}

export function isReuseView(val: unknown): val is ReuseView {
	return val != null
  && typeof val === 'object'
  && 'key' in val && typeof (val as any).key === 'string'
	&& 'index' in val && (val as any).index === null
  && 'data' in val && (val as any).data === null
  && 'layout' in val && (val as any).layout === null
}

export function isView<T>(val: unknown): val is View<T> {
	return val != null
  && typeof val === 'object'
  && 'key' in val && typeof (val as any).key === 'string'
	&& 'index' in val && (val as any).index != null
  && 'data' in val && (val as any).data != null
  && 'layout' in val && (val as any).layout != null
}
