import { ZoomComponent } from './zoom-component';

// 等待 DOM 載入完成
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('zoomContainer');

  if (!container) {
    console.error('找不到容器元素');
    return;
  }

  // 創建縮放組件
  const zoomComponent = new ZoomComponent(container, {
    minZoom: 0.5,
    maxZoom: 3,
    initialZoom: 1,
    enablePinchZoom: true,
    enableWheelZoom: true,
    enablePan: true,
    animationDuration: 300
  });

  // 創建示例內容
  const createSampleContent = (): HTMLElement => {
    const content = document.createElement('div');
    content.style.cssText = `
      width: 400px;
      height: 300px;
      background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      color: white;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      cursor: grab;
    `;

    content.innerHTML = `
      <div style="text-align: center;">
        <h2 style="margin: 0 0 10px 0;">🎯 縮放組件演示</h2>
        <p style="margin: 0;">雙指捏合或 Ctrl+滾輪縮放</p>
        <p style="margin: 5px 0 0 0;">拖曳或滾輪移動內容</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">雙擊切換縮放</p>
      </div>
    `;

    return content;
  };

  // 設置內容
  zoomComponent.setContent(createSampleContent());

  // 綁定控制按鈕
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const resetBtn = document.getElementById('reset');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      zoomComponent.zoomIn(0.2);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      zoomComponent.zoomOut(0.2);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      zoomComponent.reset();
    });
  }

  // 顯示縮放級別
  const createZoomInfo = () => {
    const info = document.createElement('div');
    info.id = 'zoomInfo';
    info.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 15px;
      border-radius: 20px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(info);
    return info;
  };

  const zoomInfo = createZoomInfo();

  // 更新縮放資訊顯示
  const updateZoomInfo = () => {
    const zoom = zoomComponent.getCurrentZoom();
    const pan = zoomComponent.getPan();
    zoomInfo.textContent = `縮放: ${zoom.toFixed(2)}x | 位置: (${pan.x.toFixed(0)}, ${pan.y.toFixed(0)})`;
  };

  // 定期更新縮放資訊
  setInterval(updateZoomInfo, 100);

  // 初始更新
  updateZoomInfo();

  console.log('縮放組件已初始化');
});
