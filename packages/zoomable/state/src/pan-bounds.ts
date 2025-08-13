import type { Bounds } from './types'
import { Point } from './types'

export class PanBounds {
	private element: HTMLElement
	private container: HTMLElement
	public bounds: Bounds

	constructor(element: HTMLElement, container: HTMLElement) {
		this.element = element
		this.container = container
		this.bounds = {
			min: { x: 0, y: 0 },
			max: { x: 0, y: 0 },
			center: { x: 0, y: 0 },
		}
	}

	// 根據當前縮放級別更新邊界
	update(zoomLevel: number): void {
		const containerRect = this.container.getBoundingClientRect()

		// 嘗試從第一個子元素獲取尺寸
		const firstChild = this.element.firstElementChild ?? this.element

		const childStyle = window.getComputedStyle(firstChild)
		const computedWidth = Number.parseFloat(childStyle.width)
		const computedHeight = Number.parseFloat(childStyle.height)

		const elementWidth = computedWidth
		const elementHeight = computedHeight

		// 計算縮放後的元素尺寸
		const scaledWidth = elementWidth * zoomLevel
		const scaledHeight = elementHeight * zoomLevel

		// 計算邊界
		this._updateAxis('x', containerRect.width, scaledWidth)
		this._updateAxis('y', containerRect.height, scaledHeight)

		// 計算中心點
		this.bounds.center = {
			x: (this.bounds.min.x + this.bounds.max.x) / 2,
			y: (this.bounds.min.y + this.bounds.max.y) / 2,
		}
	}

	private _updateAxis(axis: 'x' | 'y', containerSize: number, scaledSize: number): void {
		if (scaledSize > containerSize) {
			// 如果內容比容器大，可以拖曳
			const overflow = (scaledSize - containerSize) / 2
			this.bounds.min[axis] = -overflow
			this.bounds.max[axis] = overflow
		}
		else {
			// 如果內容比容器小，不能拖曳，保持在中心
			this.bounds.min[axis] = 0
			this.bounds.max[axis] = 0
		}
	}

	// 修正平移位置，確保不超出邊界
	correctPan(axis: 'x' | 'y', panOffset: number): number {
		if (this.bounds.min[axis] === this.bounds.max[axis]) {
			// 如果min和max相等，表示內容應該居中
			return this.bounds.min[axis]
		}

		// 限制在邊界範圍內
		return Math.max(this.bounds.min[axis], Math.min(panOffset, this.bounds.max[axis]))
	}

	// 重置邊界
	reset(): void {
		this.bounds = {
			min: { x: 0, y: 0 },
			max: { x: 0, y: 0 },
			center: { x: 0, y: 0 },
		}
	}
}
