<script lang="ts" setup>
import type { View } from '@bouzu/virtualizer'
import type { PropType, StyleValue } from 'vue'
import { useVirtualizerItem } from '@bouzu/vue-virtualizer'
import { computed, ref, toRef } from 'vue'

const props = defineProps({
	view: {
		type: Object as PropType<View<any>>,
		required: true,
	},
})
const emit = defineEmits({
	click: (index: number) => typeof index === 'number',
})
const view = toRef(props, 'view')
const contentEl = ref<HTMLElement | null>(null)

const rootStyles = computed<StyleValue>(() => ({
	position: 'absolute',
	overflow: 'hidden',
	contain: 'size layout style paint',
	top: `${view.value.layout.rect.y}px`,
	left: '0',
	width: '100%',
	height: `${view.value.layout.rect.height}px`,
	minHeight: '48px',
	zIndex: view.value.layout.estimated ? -1 : undefined,
}))

useVirtualizerItem({
	el: contentEl,
	view,
})

function handleClick() {
	emit('click', props.view.index)
}
</script>

<template>
	<div :style="rootStyles" @click="handleClick">
		<div ref="contentEl" class="flex flex-col p-3 space-y-4 hover:bg-slate">
			<h1 class="text-xl font-bold">
				#{{ props.view.data.index }} Name: {{ props.view.data.name }}
			</h1>
			<p class="break-all">
				{{ props.view.data.content }}
			</p>
		</div>
	</div>
</template>
