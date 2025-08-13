// 基本的點座標接口
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

// 縮放組件的配置選項
export interface ZoomComponentOptions {
  // 最小縮放倍數
  minZoom?: number;
  // 最大縮放倍數
  maxZoom?: number;
  // 初始縮放倍數
  initialZoom?: number;
  // 是否啟用手勢縮放
  enablePinchZoom?: boolean;
  // 是否啟用滾輪縮放
  enableWheelZoom?: boolean;
  // 是否啟用拖曳
  enablePan?: boolean;
  // 縮放動畫持續時間
  animationDuration?: number;
  // 摩擦係數
  friction?: number;
}

// 縮放範圍
export interface ZoomLevels {
  min: number;
  max: number;
  initial: number;
}

// 邊界
export interface Bounds {
  min: Point;
  max: Point;
  center: Point;
}

// 手勢事件狀態
export interface GestureState {
  isDragging: boolean;
  isZooming: boolean;
  isMultitouch: boolean;
  startTime: number;
  velocity: Point;
}
