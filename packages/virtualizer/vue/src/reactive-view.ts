import type { View } from '@bouzu/virtualizer'
import { klona } from 'klona/json'
import { type ShallowReactive, reactive, shallowReactive } from 'vue-demi'

const views = new WeakMap<View<any>, ReactiveView<any>>()

export type ReactiveView<T extends object> = ShallowReactive<View<T>>

export function toReactiveView<T extends object>(
	view: View<T>,
): ReactiveView<T> {
	const reactiveView = views.get(view) ?? createReactiveView(view)
	views.set(view, reactiveView)

	assignView(reactiveView, view)

	return reactiveView
}

function createReactiveView<T extends object>(view: View<T>): ReactiveView<T> {
	const { data, ...rest } = view
	const clonedView = klona(rest)
	const result = shallowReactive(clonedView) as unknown as ReactiveView<T>
	result.data = data
	result.layout = reactive(clonedView.layout)
	return result
}

function assignView<T extends object>(
	reactiveView: ReactiveView<T>,
	nextView: View<T>,
) {
	const { layout, data, ...rest } = nextView
	reactiveView.data = data
	reactiveView.layout.key = layout.key
	reactiveView.layout.estimated = layout.estimated
	reactiveView.layout.rect.height = layout.rect.height
	reactiveView.layout.rect.width = layout.rect.width
	reactiveView.layout.rect.y = layout.rect.y
	reactiveView.layout.rect.x = layout.rect.x

	Object.assign(reactiveView, rest)
}
