<script setup lang="ts">
import { ref } from 'vue'
import { useZoomable } from '@bouzu/vue-zoomable'

const containerRef = ref(null)
const contentRef = ref(null)
const { pan, zoom } = useZoomable(containerRef, contentRef)
</script>

<template>
	<div
		ref="containerRef"
		style="
			position: relative;
			width: 600px;
			height: 400px;
			overflow: hidden;
			border: 1px solid red;
			border-radius: 10px;
		"
	>
		<div
			ref="contentRef"
			style="
				height: 100%;
				width: 100%;
				position: relative;
				transform-origin: center center;
				transition: none;
				user-select: none;
				touch-action: none;
				will-change: transform;
				display: flex;
				align-items: center;
				justify-content: center;
			"
			:style="{
				transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale3d(${zoom}, ${zoom}, 1)`,
			}"
		>
			<div
				style="
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
				"
			>
				<div style="text-align: center;">
					<h2 style="margin: 0 0 10px 0;">
						🎯 縮放組件演示
					</h2>
					<p style="margin: 0;">
						雙指捏合或 Ctrl+滾輪縮放
					</p>
					<p style="margin: 5px 0 0 0;">
						拖曳或滾輪移動內容
					</p>
					<p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">
						雙擊切換縮放
					</p>
				</div>
			</div>
		</div>
	</div>
</template>
