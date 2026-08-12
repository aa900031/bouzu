<script setup lang="ts">
import { useZoomable } from '@bouzu/vue-zoomable'
import { ref, toRef } from 'vue'

const props = defineProps<{
	disabled?: boolean
}>()

const container = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const { zoom, pan, state, isPaning, isZooming, isTransforming, isInteracting, isAnimating } = useZoomable(container, content, {
	min: 1,
	disabled: toRef(() => props.disabled),
})

defineExpose({
	_: state,
})
</script>

<template>
	<div class="fixed right-0 bottom-0 max-w-1/2 bg-sky-300 p-3">
		<table class="table-fixed">
			<tr>
				<td>isPaning:</td>
				<td>{{ isPaning }}</td>
			</tr>
			<tr>
				<td>isZooming:</td>
				<td>{{ isZooming }}</td>
			</tr>
			<tr>
				<td>isTransforming:</td>
				<td>{{ isTransforming }}</td>
			</tr>
			<tr>
				<td>isInteracting:</td>
				<td>{{ isInteracting }}</td>
			</tr>
			<tr>
				<td>isAnimating:</td>
				<td>{{ isAnimating }}</td>
			</tr>
		</table>
	</div>
	<div
		ref="container"
		class="relative overflow-hidden flex items-center justify-center"
	>
		<div
			ref="content"
			class="relative w-fit h-fit select-none touch-none origin-cc transition-delay-none transition-none"
			:class="{
				'will-change-transform': isTransforming,
			}"
			:style="{
				transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale3d(${zoom}, ${zoom}, 1)`,
			}"
		>
			<slot
				:zoom
				:pan
				:is-paning
				:is-zooming
			/>
		</div>
	</div>
</template>
