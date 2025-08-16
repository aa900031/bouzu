<script setup lang="ts">
import { useZoomable } from '@bouzu/vue-zoomable'
import { ref, toRef } from 'vue'

const props = defineProps<{
	disabled?: boolean
}>()

const container = ref<HTMLElement | null>(null)
const content = ref<HTMLElement | null>(null)
const { zoom, pan, state } = useZoomable(container, content, {
	options: {
		min: 1,
	},
	disabled: toRef(() => props.disabled),
})

defineExpose({
	_: state,
})
</script>

<template>
	<div
		ref="container"
		class="relative overflow-hidden flex items-center justify-center"
	>
		<div
			ref="content"
			class="relative w-fit h-fit transition-none select-none touch-none will-change-transform origin-cc"
			:style="{
				'transform': `translate3d(${pan.x}px, ${pan.y}px, 0px) scale3d(${zoom}, ${zoom}, 1)`,
				'transition-delay': '0',
			}"
		>
			<slot />
		</div>
	</div>
</template>
