import { easeOutCubic } from './utils';

export interface AnimationOptions {
  start: number;
  end: number;
  duration: number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
  easing?: (t: number) => number;
}

export class Animations {
  private activeAnimations: Map<string, number> = new Map();

  // 開始動畫
  start(name: string, options: AnimationOptions): void {
    this.stop(name);

    const startTime = performance.now();
    const { start, end, duration, onUpdate, onComplete, easing = easeOutCubic } = options;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const value = start + (end - start) * easing(progress);
      onUpdate(value);

      if (progress < 1) {
        const rafId = requestAnimationFrame(animate);
        this.activeAnimations.set(name, rafId);
      } else {
        this.activeAnimations.delete(name);
        onComplete?.();
      }
    };

    const rafId = requestAnimationFrame(animate);
    this.activeAnimations.set(name, rafId);
  }

  // 停止指定動畫
  stop(name: string): void {
    const rafId = this.activeAnimations.get(name);
    if (rafId) {
      cancelAnimationFrame(rafId);
      this.activeAnimations.delete(name);
    }
  }

  // 停止所有動畫
  stopAll(): void {
    this.activeAnimations.forEach((rafId) => {
      cancelAnimationFrame(rafId);
    });
    this.activeAnimations.clear();
  }

  // 檢查是否有動畫在運行
  isAnimating(): boolean {
    return this.activeAnimations.size > 0;
  }
}
