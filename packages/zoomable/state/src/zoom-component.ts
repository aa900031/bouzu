import type { Point, ZoomComponentOptions, ZoomLevels } from './types'
import { GestureHandler } from './gesture-handler'
import { PanBounds } from './pan-bounds'
import { Animations } from './animations'
import { clamp, project } from './utils'

const DEFAULT_OPTIONS: Required<ZoomComponentOptions> = {
	minZoom: 0.5,
	maxZoom: 3,
	initialZoom: 1,
	enablePinchZoom: true,
	enableWheelZoom: true,
	enablePan: true,
	animationDuration: 300,
	friction: 0.8,
}

export class ZoomComponent {
	private container: HTMLElement
	private content: HTMLElement
	private options: Required<ZoomComponentOptions>
	private gestureHandler: GestureHandler
	private panBounds: PanBounds
	private animations: Animations

	// 狀態
	private currentZoom = 1
	private pan: Point = { x: 0, y: 0 }
	private zoomLevels: ZoomLevels

	// 縮放手勢狀態
	private startZoom = 1
	private startPan: Point = { x: 0, y: 0 }

	// 滾輪事件防抖
	private wheelTimeout: number | null = null

	constructor(container: HTMLElement, options: ZoomComponentOptions = {}) {
		this.container = container
		this.options = { ...DEFAULT_OPTIONS, ...options }

		// 確保容器有正確的樣式
		this._setupContainer()

		// 創建內容容器
		this.content = this._createContent()
		this.container.appendChild(this.content)

		// 初始化縮放範圍
		this.zoomLevels = {
			min: this.options.minZoom,
			max: this.options.maxZoom,
			initial: this.options.initialZoom,
		}

		// 初始化組件
		this.panBounds = new PanBounds(this.content, this.container)
		this.animations = new Animations()
		this.gestureHandler = new GestureHandler(this.container)

		this._bindEvents()
		this._setupInitialState()
	}

	private _setupContainer(): void {
		// 確保容器有相對定位
		const computedStyle = window.getComputedStyle(this.container)
		if (computedStyle.position === 'static')
			this.container.style.position = 'relative'
	}

	private _createContent(): HTMLElement {
		const content = document.createElement('div')
		content.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      transform-origin: center center;
      transition: none;
      user-select: none;
      touch-action: none;
      will-change: transform;
      display: flex;
      align-items: center;
      justify-content: center;
    `
		return content
	}

	private _bindEvents(): void {
		// 綁定手勢事件
		this.gestureHandler.onDragStart = this._onDragStart.bind(this)
		this.gestureHandler.onDragChange = this._onDragChange.bind(this)
		this.gestureHandler.onDragEnd = this._onDragEnd.bind(this)
		this.gestureHandler.onZoomStart = this._onZoomStart.bind(this)
		this.gestureHandler.onZoomChange = this._onZoomChange.bind(this)
		this.gestureHandler.onZoomEnd = this._onZoomEnd.bind(this)
		this.gestureHandler.onDoubleTap = this._onDoubleTap.bind(this)

		// 滾輪事件（用於縮放和拖曳）
		if (this.options.enableWheelZoom || this.options.enablePan)
			this.container.addEventListener('wheel', this._onWheel.bind(this), { passive: false })

		// 雙擊切換縮放
		this.container.addEventListener('dblclick', this._onDoubleClick.bind(this))
	}

	/**
	 * 雙擊時切換縮放：在初始和最大縮放之間切換，並以點擊位置為中心
	 */
	private _onDoubleClick(e: MouseEvent): void {
		const rect = this.container.getBoundingClientRect()
		const centerX = rect.width / 2
		const centerY = rect.height / 2
		const clickX = e.clientX - rect.left
		const clickY = e.clientY - rect.top
		const rel = { x: clickX - centerX, y: clickY - centerY }
		// 在初始和最大縮放之間切換
		const targetZoom = this.currentZoom > this.zoomLevels.initial ? this.zoomLevels.initial : this.zoomLevels.max
		this.zoomTo(targetZoom, rel)
	}

	/**
	 * 處理觸控裝置上的雙擊事件
	 */
	private _onDoubleTap(point: Point): void {
		const rect = this.container.getBoundingClientRect()
		const centerX = rect.width / 2
		const centerY = rect.height / 2
		const rel = { x: point.x - centerX, y: point.y - centerY }
		// 在初始和最大縮放之間切換
		const targetZoom = this.currentZoom > this.zoomLevels.initial ? this.zoomLevels.initial : this.zoomLevels.max
		this.zoomTo(targetZoom, rel)
	}

	private _setupInitialState(): void {
		this.currentZoom = this.options.initialZoom
		this.pan = { x: 0, y: 0 }
		this._updatePanBounds()
		this._applyTransform()
	}

	private _onDragStart(): void {
		this.animations.stopAll()
		this.startPan = { ...this.pan }
	}

	private _onDragChange(): void {
		if (!this.options.enablePan)
			return

		const delta = this.gestureHandler.getDragDelta()

		// 更新平移位置
		const newPan = {
			x: this.pan.x + delta.x,
			y: this.pan.y + delta.y,
		}

		this.pan.x = newPan.x
		this.pan.y = newPan.y

		this._applyTransform()
	}

	private _onDragEnd(): void {
		if (!this.options.enablePan)
			return

		// 首先修正當前位置到邊界內
		const correctedPan = {
			x: this.panBounds.correctPan('x', this.pan.x),
			y: this.panBounds.correctPan('y', this.pan.y),
		}

		// 檢查是否需要立即修正邊界
		const needsBoundaryCorrection
      = Math.abs(correctedPan.x - this.pan.x) > 0.1
      || Math.abs(correctedPan.y - this.pan.y) > 0.1

		// 應用慣性
		const velocity = this.gestureHandler.velocity
		const decelerationRate = 0.95

		// 計算最終位置（從修正後的位置開始）
		const projectedPan = {
			x: correctedPan.x + project(velocity.x, decelerationRate),
			y: correctedPan.y + project(velocity.y, decelerationRate),
		}

		// 修正邊界
		const finalPan = {
			x: this.panBounds.correctPan('x', projectedPan.x),
			y: this.panBounds.correctPan('y', projectedPan.y),
		}

		// 檢查是否需要動畫
		const needsInertiaAnimation
      = Math.abs(finalPan.x - correctedPan.x) > 1
      || Math.abs(finalPan.y - correctedPan.y) > 1

		if (needsBoundaryCorrection) {
			// 如果超出邊界，優先修正邊界
			if (needsInertiaAnimation) {
				// 有慣性且需要邊界修正，動畫到最終位置
				this._animatePan(finalPan)
			}
			else {
				// 只需要邊界修正，動畫到邊界內
				this._animatePan(correctedPan)
			}
		}
		else if (needsInertiaAnimation) {
			// 在邊界內但有慣性，動畫到最終位置
			this._animatePan(finalPan)
		}
		// 如果既不需要邊界修正也沒有明顯慣性，不執行動畫
	}

	private _onZoomStart(): void {
		this.animations.stopAll()
		this.startZoom = this.currentZoom
		this.startPan = { ...this.pan }
	}

	private _onZoomChange(): void {
		if (!this.options.enablePinchZoom)
			return

		const currentDistance = this.gestureHandler.getZoomDistance()
		const startDistance = this.gestureHandler.getStartZoomDistance()

		if (startDistance > 0) {
			const zoomFactor = currentDistance / startDistance
			let newZoom = this.startZoom * zoomFactor

			// 限制縮放範圍，但允許輕微超出以提供反饋
			const minZoomWithFriction = this.zoomLevels.min * 0.8
			const maxZoomWithFriction = this.zoomLevels.max * 1.2

			if (newZoom < this.zoomLevels.min) {
				newZoom = this.zoomLevels.min + (newZoom - this.zoomLevels.min) * 0.3
				newZoom = Math.max(newZoom, minZoomWithFriction)
			}
			else if (newZoom > this.zoomLevels.max) {
				newZoom = this.zoomLevels.max + (newZoom - this.zoomLevels.max) * 0.3
				newZoom = Math.min(newZoom, maxZoomWithFriction)
			}

			// 獲取縮放中心點（相對於容器中心）
			const zoomCenter = this.gestureHandler.getZoomCenter()
			const containerRect = this.container.getBoundingClientRect()
			const centerX = containerRect.width / 2
			const centerY = containerRect.height / 2

			const relativeCenterX = zoomCenter.x - centerX
			const relativeCenterY = zoomCenter.y - centerY

			// 計算新的平移位置以保持縮放中心點固定
			const actualZoomFactor = newZoom / this.startZoom
			const newPan = {
				x: relativeCenterX - (relativeCenterX - this.startPan.x) * actualZoomFactor,
				y: relativeCenterY - (relativeCenterY - this.startPan.y) * actualZoomFactor,
			}

			this.currentZoom = newZoom
			this.pan = newPan

			this._updatePanBounds()
			this._applyTransform()
		}
	}

	private _onZoomEnd(): void {
		// 立即檢查並修正縮放和平移
		this._correctZoomAndPan()
	}

	private _onWheel(e: WheelEvent): void {
		e.preventDefault()

		// 檢查是否按下 Ctrl 鍵來決定是縮放還是拖曳
		if (e.ctrlKey || e.metaKey) {
			// Ctrl + 滾輪 = 縮放
			if (!this.options.enableWheelZoom)
				return

			const delta = e.deltaY > 0 ? -0.1 : 0.1
			const newZoom = clamp(this.currentZoom + delta, this.zoomLevels.min, this.zoomLevels.max)

			if (newZoom !== this.currentZoom) {
				// 獲取滑鼠位置作為縮放中心（相對於容器中心）
				const rect = this.container.getBoundingClientRect()
				const centerX = rect.width / 2
				const centerY = rect.height / 2

				const zoomCenter = {
					x: (e.clientX - rect.left) - centerX,
					y: (e.clientY - rect.top) - centerY,
				}

				// 計算新的平移位置
				const zoomFactor = newZoom / this.currentZoom
				const newPan = {
					x: zoomCenter.x - (zoomCenter.x - this.pan.x) * zoomFactor,
					y: zoomCenter.y - (zoomCenter.y - this.pan.y) * zoomFactor,
				}

				this.currentZoom = newZoom
				this.pan = newPan
				this._updatePanBounds()
				this._applyTransform()

				// 清除之前的計時器
				if (this.wheelTimeout)
					clearTimeout(this.wheelTimeout)

				// 設置新的計時器，在滾輪事件結束後執行邊界檢查
				this.wheelTimeout = window.setTimeout(() => {
					this._correctZoomAndPan()
					this.wheelTimeout = null
				}, 150) // 150ms 後執行邊界檢查
			}
		}
		else {
			// 普通滾輪 = 拖曳（平移）
			if (!this.options.enablePan)
				return

			// 滾輪的拖曳行為：垂直滾動對應垂直拖曳，水平滾動（如果支援）對應水平拖曳
			const dragSpeed = 1.0 // 調整拖曳靈敏度
			const delta = {
				x: e.deltaX * dragSpeed,
				y: e.deltaY * dragSpeed,
			}

			// 更新平移位置
			const newPan = {
				x: this.pan.x - delta.x, // 負號讓滾動方向符合直覺
				y: this.pan.y - delta.y,
			}

			// 滾輪拖曳時立即應用邊界限制，不使用動畫
			this.pan.x = this.panBounds.correctPan('x', newPan.x)
			this.pan.y = this.panBounds.correctPan('y', newPan.y)
			this._applyTransform()
		}
	}

	private _correctZoomAndPan(): void {
		let needsCorrection = false
		let targetZoom = this.currentZoom
		let targetPan = { ...this.pan }

		// 檢查縮放範圍
		if (this.currentZoom < this.zoomLevels.min) {
			targetZoom = this.zoomLevels.min
			needsCorrection = true
		}
		else if (this.currentZoom > this.zoomLevels.max) {
			targetZoom = this.zoomLevels.max
			needsCorrection = true
		}

		// 如果縮放需要修正，重新計算邊界
		if (targetZoom !== this.currentZoom) {
			// 暫時設置目標縮放來計算正確的邊界
			const originalZoom = this.currentZoom
			this.currentZoom = targetZoom
			this._updatePanBounds()
			this.currentZoom = originalZoom // 恢復原來的縮放
		}

		// 檢查平移邊界
		const correctedPan = {
			x: this.panBounds.correctPan('x', targetPan.x),
			y: this.panBounds.correctPan('y', targetPan.y),
		}

		if (Math.abs(correctedPan.x - targetPan.x) > 0.1 || Math.abs(correctedPan.y - targetPan.y) > 0.1) {
			targetPan = correctedPan
			needsCorrection = true
		}

		if (needsCorrection)
			this._animateZoomAndPan(targetZoom, targetPan)
	}

	private _animatePan(targetPan: Point): void {
		const startPan = { ...this.pan }

		this.animations.start('pan', {
			start: 0,
			end: 1,
			duration: this.options.animationDuration,
			onUpdate: (progress) => {
				this.pan.x = startPan.x + (targetPan.x - startPan.x) * progress
				this.pan.y = startPan.y + (targetPan.y - startPan.y) * progress
				this._applyTransform()
			},
		})
	}

	private _animateZoomAndPan(targetZoom: number, targetPan: Point): void {
		const startZoom = this.currentZoom
		const startPan = { ...this.pan }

		this.animations.start('zoomAndPan', {
			start: 0,
			end: 1,
			duration: this.options.animationDuration,
			onUpdate: (progress) => {
				this.currentZoom = startZoom + (targetZoom - startZoom) * progress
				this.pan.x = startPan.x + (targetPan.x - startPan.x) * progress
				this.pan.y = startPan.y + (targetPan.y - startPan.y) * progress
				this._updatePanBounds()
				this._applyTransform()
			},
		})
	}

	private _updatePanBounds(): void {
		this.panBounds.update(this.currentZoom)
	}

	private _applyTransform(): void {
		const translateX = this.pan.x
		const translateY = this.pan.y

		this.content.style.transform = `translate3d(${translateX}px, ${translateY}px, 0px) scale3d(${this.currentZoom}, ${this.currentZoom}, 1)`
	}

	// 公開方法
	public setContent(element: HTMLElement): void {
		this.content.innerHTML = ''
		this.content.appendChild(element)
		this._updatePanBounds()
	}

	public setContentHTML(html: string): void {
		this.content.innerHTML = html
		this._updatePanBounds()
	}

	public zoomTo(zoom: number, center?: Point): void {
		const targetZoom = clamp(zoom, this.zoomLevels.min, this.zoomLevels.max)

		let targetPan = { ...this.pan }

		if (center) {
			// center 已經是相對於容器中心的座標
			const zoomFactor = targetZoom / this.currentZoom
			targetPan = {
				x: center.x - (center.x - this.pan.x) * zoomFactor,
				y: center.y - (center.y - this.pan.y) * zoomFactor,
			}
		}

		// 計算正確的邊界
		const tempZoom = this.currentZoom
		this.currentZoom = targetZoom
		this._updatePanBounds()
		this.currentZoom = tempZoom

		// 修正平移位置
		const correctedPan = {
			x: this.panBounds.correctPan('x', targetPan.x),
			y: this.panBounds.correctPan('y', targetPan.y),
		}

		this._animateZoomAndPan(targetZoom, correctedPan)
	}

	public zoomIn(step = 0.2): void {
		// 以容器中心為縮放中心
		this.zoomTo(this.currentZoom + step, { x: 0, y: 0 })
	}

	public zoomOut(step = 0.2): void {
		// 以容器中心為縮放中心
		this.zoomTo(this.currentZoom - step, { x: 0, y: 0 })
	}

	public reset(): void {
		const targetZoom = this.options.initialZoom
		const targetPan = { x: 0, y: 0 }
		this._animateZoomAndPan(targetZoom, targetPan)
	}

	public getCurrentZoom(): number {
		return this.currentZoom
	}

	public getPan(): Point {
		return { ...this.pan }
	}

	public setZoomLevels(min: number, max: number, initial?: number): void {
		this.zoomLevels.min = min
		this.zoomLevels.max = max

		if (initial !== undefined)
			this.zoomLevels.initial = initial

		// 確保當前縮放在新範圍內
		if (this.currentZoom < min || this.currentZoom > max)
			this.zoomTo(clamp(this.currentZoom, min, max))
	}

	public destroy(): void {
		// 清理計時器
		if (this.wheelTimeout) {
			clearTimeout(this.wheelTimeout)
			this.wheelTimeout = null
		}

		this.animations.stopAll()
		this.gestureHandler.destroy()
		this.container.removeChild(this.content)
	}
}
