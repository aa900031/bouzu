import type { Virtualizer, VirtualizerEventHandler } from './virtualizer'
import Mock from 'mockjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createListLayouts } from './layouts/list'
import { createVirtualizer, VirtualizerEvent } from './virtualizer'

interface Item {
	index: number
	id: string
	account: string
	// desc: string
}

const DATA: Item[] = Array.from(Array.from({ length: 100 }).keys()).map(index => ({
	index: index + 1,
	id: Mock.Random.guid(),
	account: Mock.Random.name(),
	// desc: Mock.Random.word(300, 500),
}))

describe('virtualizer', () => {
	let virtualizer: Virtualizer<Item>
	const handleVisibleViewsChange = vi.fn<
		(...args: Parameters<VirtualizerEventHandler<Item, typeof VirtualizerEvent.ChangeVisibleViews>>) => void
	>()

	beforeEach(() => {
		virtualizer = createVirtualizer<Item>()
		handleVisibleViewsChange.mockClear()
	})

	afterEach(() => {
		virtualizer.destroy()
	})

	it('visibleRect.y -> 0 ~ 500', () => new Promise<void>((resolve) => {
		const TOTAL_HEIGHT = 500
		const ITEM_HEIGHTS = [65, 80, 110]

		handleVisibleViewsChange.mockImplementationOnce(({ value }) => {
			const views = Array.from(value)
			expect(views[0].data.index).toBe(1)
			expect(views.length).toBe(11)
			expect(views.every((item: any) => item.layout.estimated)).toBe(true)
			views.forEach((view: any, index: number) => {
				if (!view.layout.estimated)
					return
				virtualizer.updateItemSize(view.data, {
					width: 120,
					height: ITEM_HEIGHTS[index % 3],
				})
			})
		}).mockImplementationOnce(({ value }) => {
			const views = Array.from(value)
			expect(views[0].data.index).toBe(1)
			expect(views.length).toBe(6)

			// 模仿滾動到 500px
			virtualizer.setVisibleRect({ x: 0, y: 500, width: 120, height: TOTAL_HEIGHT })
		}).mockImplementationOnce(({ value }) => {
			const views = Array.from(value) as any[]
			expect(views[0].data.index).toBe(6)
			expect(views.length).toBe(8)

			const contentSize = virtualizer.getContentSize()
			const visibleRect = virtualizer.getVisibleRect()
			const maxVisibleY = contentSize.height - visibleRect.height

			// 模仿滾動到底
			virtualizer.setVisibleRect({ x: 0, y: maxVisibleY, width: 120, height: TOTAL_HEIGHT })
		}).mockImplementationOnce(({ value }) => {
			const views = Array.from(value)
			expect(views[0].data.index).toBe(90)
			expect(views[views.length - 1].data.index).toBe(100)
			resolve()
		})

		virtualizer.on(VirtualizerEvent.ChangeVisibleViews, handleVisibleViewsChange as any)
		virtualizer.setLayouts(createListLayouts())
		virtualizer.setData(DATA)
		virtualizer.setVisibleRect({ x: 0, y: 0, width: 120, height: TOTAL_HEIGHT })
	}))
})
