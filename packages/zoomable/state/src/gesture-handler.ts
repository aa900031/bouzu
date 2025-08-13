import type { GestureState, Point } from './types'
import { equalizePoints, getCenter, getDistance, getPointFromEvent, getRelativePosition, pointsEqual } from './utils'

export class GestureHandler {
	private container: HTMLElement
	private state: GestureState

	// 指針位置
	public p1: Point = { x: 0, y: 0 }
	public p2: Point = { x: 0, y: 0 }
	public prevP1: Point = { x: 0, y: 0 }
	public prevP2: Point = { x: 0, y: 0 }
	public startP1: Point = { x: 0, y: 0 }
	public startP2: Point = { x: 0, y: 0 }

	// 手勢狀態
	public velocity: Point = { x: 0, y: 0 }
	public dragAxis: 'x' | 'y' | null = null

	private numActivePoints = 0
	private intervalTime = 0
	private intervalP1: Point = { x: 0, y: 0 }
	private velocityCalculated = false

	// 事件回調
	public onDragStart?: () => void
	public onDragChange?: () => void
	public onDragEnd?: () => void
	public onZoomStart?: () => void
	public onZoomChange?: () => void
	public onZoomEnd?: () => void
	public onDoubleTap?: (point: Point) => void

	// 雙擊相關變數
	private lastTapTime = 0
	private lastTapPosition: Point = { x: 0, y: 0 }

	constructor(container: HTMLElement) {
		this.container = container
		this.state = {
			isDragging: false,
			isZooming: false,
			isMultitouch: false,
			startTime: 0,
			velocity: { x: 0, y: 0 },
		}

		this._bindEvents()
	}

	private _bindEvents(): void {
		// 回退到 Touch 和 Mouse Events
		this.container.addEventListener('touchstart', this._onTouchStart.bind(this))
		this.container.addEventListener('touchmove', this._onTouchMove.bind(this))
		this.container.addEventListener('touchend', this._onTouchEnd.bind(this))
		this.container.addEventListener('touchcancel', this._onTouchEnd.bind(this))

		this.container.addEventListener('mousedown', this._onMouseDown.bind(this))
		this.container.addEventListener('mousemove', this._onMouseMove.bind(this))
		this.container.addEventListener('mouseup', this._onMouseUp.bind(this))

		// 全域滑鼠事件處理
		document.addEventListener('mousemove', this._onGlobalMouseMove.bind(this))
		document.addEventListener('mouseup', this._onGlobalMouseUp.bind(this))
	}

	private _onGlobalMouseMove(e: MouseEvent): void {
		if (this.numActivePoints > 0 && !this._isPointInContainer(e)) {
			if (this.state.isDragging)
				this._endGestureFromOutOfBounds()
		}
	}

	private _onGlobalMouseUp(e: MouseEvent): void {
		if (this.numActivePoints > 0)
			this._onMouseUp(e)
	}

	private _onTouchStart(e: TouchEvent): void {
		e.preventDefault()
		this._updatePointsFromTouch(e, 'down')
		this._onGestureStart()

		// 檢查是否為雙擊
		if (e.touches.length === 1) {
			const currentTime = Date.now()
			const timeDiff = currentTime - this.lastTapTime
			const touch = e.touches[0]
			const currentPosition = {
				x: touch.clientX - this.container.getBoundingClientRect().left,
				y: touch.clientY - this.container.getBoundingClientRect().top,
			}

			const distance = Math.sqrt(
				(currentPosition.x - this.lastTapPosition.x) ** 2
				+ (currentPosition.y - this.lastTapPosition.y) ** 2,
			)

			// 如果兩次點擊間隔小於 300ms 且位置相差不超過 30px，則視為雙擊
			if (timeDiff < 300 && distance < 30) {
				this.onDoubleTap?.(currentPosition)
				this.lastTapTime = 0 // 重置以避免連續觸發
			}
			else {
				this.lastTapTime = currentTime
				this.lastTapPosition = currentPosition
			}
		}
	}

	private _onTouchMove(e: TouchEvent): void {
		this._updatePointsFromTouch(e, 'move')
		this._onGestureChange()
	}

	private _onTouchEnd(e: TouchEvent): void {
		this._updatePointsFromTouch(e, 'up')
		this._onGestureEnd()
	}

	private _onMouseDown(e: MouseEvent): void {
		e.preventDefault()
		this._updatePointsFromMouse(e, 'down')
		this._onGestureStart()
	}

	private _onMouseMove(e: MouseEvent): void {
		if (this.numActivePoints > 0) {
			// 檢查滑鼠是否還在容器內
			if (this._isPointInContainer(e)) {
				this._updatePointsFromMouse(e, 'move')
				this._onGestureChange()
			}
			else if (this.state.isDragging) {
				// 如果拖曳時滑鼠移出容器，結束拖曳
				this._endGestureFromOutOfBounds()
			}
		}
	}

	private _onMouseUp(e: MouseEvent): void {
		this._updatePointsFromMouse(e, 'up')
		this._onGestureEnd()
	}

	private _isPointInContainer(e: MouseEvent | PointerEvent): boolean {
		const rect = this.container.getBoundingClientRect()
		return (
			e.clientX >= rect.left
			&& e.clientX <= rect.right
			&& e.clientY >= rect.top
			&& e.clientY <= rect.bottom
		)
	}

	private _endGestureFromOutOfBounds(): void {
		// 模擬手勢結束
		this.numActivePoints = 0
		this._onGestureEnd()
	}

	private _updatePoints(e: PointerEvent, eventType: 'down' | 'move' | 'up'): void {
		const point = getRelativePosition(e, this.container)

		if (eventType === 'down') {
			this.numActivePoints = 1
			equalizePoints(this.p1, point)
			equalizePoints(this.startP1, point)
		}
		else if (eventType === 'move') {
			equalizePoints(this.p1, point)
		}
		else if (eventType === 'up') {
			this.numActivePoints = 0
		}
	}

	private _updatePointsFromTouch(e: TouchEvent, eventType: 'down' | 'move' | 'up'): void {
		if (eventType === 'down' || eventType === 'move') {
			this.numActivePoints = e.touches.length

			if (e.touches.length >= 1) {
				const touch1 = e.touches[0]
				const point1 = {
					x: touch1.clientX - this.container.getBoundingClientRect().left,
					y: touch1.clientY - this.container.getBoundingClientRect().top,
				}
				equalizePoints(this.p1, point1)

				if (eventType === 'down')
					equalizePoints(this.startP1, point1)
			}

			if (e.touches.length >= 2) {
				const touch2 = e.touches[1]
				const point2 = {
					x: touch2.clientX - this.container.getBoundingClientRect().left,
					y: touch2.clientY - this.container.getBoundingClientRect().top,
				}
				equalizePoints(this.p2, point2)

				if (eventType === 'down')
					equalizePoints(this.startP2, point2)
			}
		}
		else {
			this.numActivePoints = e.touches.length
		}
	}

	private _updatePointsFromMouse(e: MouseEvent, eventType: 'down' | 'move' | 'up'): void {
		const point = getRelativePosition(e, this.container)

		if (eventType === 'down') {
			this.numActivePoints = 1
			equalizePoints(this.p1, point)
			equalizePoints(this.startP1, point)
		}
		else if (eventType === 'move') {
			equalizePoints(this.p1, point)
		}
		else if (eventType === 'up') {
			this.numActivePoints = 0
		}
	}

	private _onGestureStart(): void {
		this.state.startTime = Date.now()
		this.intervalTime = this.state.startTime
		equalizePoints(this.intervalP1, this.p1)
		this.velocityCalculated = false

		if (this.numActivePoints === 1) {
			this.dragAxis = null
			this._updatePrevPoints()
		}

		if (this.numActivePoints > 1) {
			this.state.isMultitouch = true
			this._updatePrevPoints()
		}
	}

	private _onGestureChange(): void {
		if (this.numActivePoints === 1 && !this.state.isZooming) {
			if (!this.state.isDragging) {
				this._calculateDragDirection()

				if (this.dragAxis) {
					this.state.isDragging = true
					this.onDragStart?.()
				}
			}

			if (this.state.isDragging && !pointsEqual(this.p1, this.prevP1)) {
				this._updateVelocity()
				this.onDragChange?.()
			}
		}
		else if (this.numActivePoints > 1 && !this.state.isDragging) {
			if (!this.state.isZooming) {
				this.state.isZooming = true
				this.onZoomStart?.()
			}

			if (!pointsEqual(this.p1, this.prevP1) || !pointsEqual(this.p2, this.prevP2))
				this.onZoomChange?.()
		}

		this._updatePrevPoints()
	}

	private _onGestureEnd(): void {
		if (this.numActivePoints === 0) {
			if (this.state.isDragging) {
				this.state.isDragging = false
				this._updateVelocity(true)
				this.onDragEnd?.()
			}

			if (this.state.isZooming) {
				this.state.isZooming = false
				this.onZoomEnd?.()
			}

			this.state.isMultitouch = false
			this.dragAxis = null
		}
	}

	private _calculateDragDirection(): void {
		const AXIS_SWIPE_HYSTERESIS = 10

		const diffX = Math.abs(this.p1.x - this.startP1.x)
		const diffY = Math.abs(this.p1.y - this.startP1.y)

		if (diffX >= AXIS_SWIPE_HYSTERESIS || diffY >= AXIS_SWIPE_HYSTERESIS)
			this.dragAxis = diffX > diffY ? 'x' : 'y'
	}

	private _updateVelocity(force = false): void {
		const time = Date.now()
		const duration = time - this.intervalTime

		if (duration < 50 && !force)
			return

		this.velocity.x = this._getVelocity('x', duration)
		this.velocity.y = this._getVelocity('y', duration)

		this.intervalTime = time
		equalizePoints(this.intervalP1, this.p1)
		this.velocityCalculated = true
	}

	private _getVelocity(axis: 'x' | 'y', duration: number): number {
		const displacement = this.p1[axis] - this.intervalP1[axis]

		if (Math.abs(displacement) > 1 && duration > 5)
			return displacement / duration

		return 0
	}

	private _updatePrevPoints(): void {
		equalizePoints(this.prevP1, this.p1)
		equalizePoints(this.prevP2, this.p2)
	}

	// 清理事件監聽器
	destroy(): void {
		this.container.removeEventListener('touchstart', this._onTouchStart.bind(this))
		this.container.removeEventListener('touchmove', this._onTouchMove.bind(this))
		this.container.removeEventListener('touchend', this._onTouchEnd.bind(this))
		this.container.removeEventListener('touchcancel', this._onTouchEnd.bind(this))

		this.container.removeEventListener('mousedown', this._onMouseDown.bind(this))
		this.container.removeEventListener('mousemove', this._onMouseMove.bind(this))
		this.container.removeEventListener('mouseup', this._onMouseUp.bind(this))

		document.removeEventListener('mousemove', this._onGlobalMouseMove.bind(this))
		document.removeEventListener('mouseup', this._onGlobalMouseUp.bind(this))
	}

	// 獲取當前縮放中心點
	getZoomCenter(): Point {
		if (this.numActivePoints > 1)
			return getCenter(this.p1, this.p2)

		return { ...this.p1 }
	}

	// 獲取當前縮放距離
	getZoomDistance(): number {
		if (this.numActivePoints > 1)
			return getDistance(this.p1, this.p2)

		return 0
	}

	// 獲取開始縮放距離
	getStartZoomDistance(): number {
		if (this.numActivePoints > 1)
			return getDistance(this.startP1, this.startP2)

		return 0
	}

	// 取得拖曳增量
	getDragDelta(): Point {
		return {
			x: this.p1.x - this.prevP1.x,
			y: this.p1.y - this.prevP1.y,
		}
	}

	get isDragging(): boolean {
		return this.state.isDragging
	}

	get isZooming(): boolean {
		return this.state.isZooming
	}

	get isMultitouch(): boolean {
		return this.state.isMultitouch
	}
}
