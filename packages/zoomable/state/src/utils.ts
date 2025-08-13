import { Point, Size } from './types';

// 限制值在指定範圍內
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// 計算兩點之間的距離
export function getDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 計算兩點的中心點
export function getCenter(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

// 複製點
export function equalizePoints(dest: Point, src: Point): Point {
  dest.x = src.x;
  dest.y = src.y;
  return dest;
}

// 比較兩點是否相等
export function pointsEqual(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < 0.01 && Math.abs(p1.y - p2.y) < 0.01;
}

// 計算投影位置（考慮慣性）
export function project(velocity: number, decelerationRate: number): number {
  return velocity * decelerationRate / (1 - decelerationRate);
}

// 四捨五入點座標
export function roundPoint(point: Point): void {
  point.x = Math.round(point.x);
  point.y = Math.round(point.y);
}

// 從觸摸或滑鼠事件中獲取點座標
export function getPointFromEvent(e: PointerEvent | TouchEvent | MouseEvent | Touch, index = 0): Point {
  if ('touches' in e && e.touches.length > index) {
    return {
      x: e.touches[index].clientX,
      y: e.touches[index].clientY
    };
  }

  if ('clientX' in e) {
    return {
      x: e.clientX,
      y: e.clientY
    };
  }

  return { x: 0, y: 0 };
}

// 簡單的緩動函數
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// 將相對座標轉換為容器內的絕對座標
export function getRelativePosition(e: PointerEvent | TouchEvent | MouseEvent | Touch, container: HTMLElement): Point {
  const rect = container.getBoundingClientRect();
  let point: Point;

  if ('clientX' in e) {
    point = { x: e.clientX, y: e.clientY };
  } else {
    point = getPointFromEvent(e);
  }

  return {
    x: point.x - rect.left,
    y: point.y - rect.top
  };
}
