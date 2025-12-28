<script setup lang="ts">
import { useAffix } from '@bouzu/vue-affix'
import { ref } from 'vue'

const targetRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const { targetStyle, contentStyle } = useAffix({
	target: targetRef,
	container: containerRef,
})
</script>

<template>
	<div class="h-1000">
		<div
			ref="containerRef"
			class="m-5 bg-blue h-50"
		>
			<div
				ref="targetRef"
				:style="targetStyle"
			>
				<div :style="contentStyle">
					<div class="py-2 px-3 bg-yellow">
						Hi Affix
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
