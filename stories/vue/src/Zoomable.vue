<script setup lang="ts">
import Zoomable from './components/Zoomable.vue'
</script>

<template>
	<div class="w-[600px] h-[400px]">
		<Zoomable
			class="w-full h-full border border-red rounded-2.5"
		>
			<div
				class="
					w-[400px] h-[300px] rounded-3 flex flex-col justify-center items-center text-white text-lg font-bold cursor-grab
					[background:linear-gradient(45deg,#ff6b6b,#4ecdc4,#45b7d1,#96ceb4)]
					shadow-[0_8px_32px_rgba(0,0,0,0.1)]
					 [text-shadow:2px_2px_4px_rgba(0,0,0,0.3)]
				"
			>
				<div class="text-center">
					<h2 class="m-0 mb-2.5">
						🎯 縮放組件演示
					</h2>
					<p class="m-0">
						雙指捏合或 Ctrl+滾輪縮放
					</p>
					<p class="m-0 mt-1">
						拖曳或滾輪移動內容
					</p>
					<p class="m-0 mt-1 text-sm opacity-80">
						雙擊切換縮放
					</p>
				</div>
			</div>
		</Zoomable>
	</div>
</template>
