<script setup lang="ts">
import { AffixAlign } from '@bouzu/affix'
import { useAffix } from '@bouzu/vue-affix'
import { ref } from 'vue'

const targetRef = ref<HTMLElement | null>(null)
const { targetStyle, contentStyle } = useAffix({
	target: targetRef,
	align: AffixAlign.End,
})
</script>

<template>
	<div class="h-1000">
		<div class="bg-gray-300 h-800" />
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
</template>
