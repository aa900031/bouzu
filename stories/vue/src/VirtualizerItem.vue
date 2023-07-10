<script lang="ts" setup>
import Mock from 'mockjs'
import type { PropType } from 'vue'
import { computed, ref, toRef } from 'vue'
import type { View } from '@bouzu/virtualizer'
import { useVirtualizerItem } from '@bouzu/vue-virtualizer'

const props = defineProps({
	view: {
		type: Object as PropType<View<any>>,
		required: true,
	},
})
const view = toRef(props, 'view')
const contentEl = ref<HTMLElement | null>(null)

const rootStyles = computed(() => ({
	'position': 'absolute',
	'overflow': 'hidden',
	'contain': 'size layout style paint',
	'top': `${view.value.layout.rect.y}px`,
	'left': '0',
	'width': '100%',
	'height': `${view.value.layout.rect.height}px`,
	'minHeight': '48px',
	'z-index': view.value.layout.estimated ? -1 : undefined,
}))

const contentStyles = computed(() => ({
	wordBreak: 'break-all',
}))

useVirtualizerItem({
	el: contentEl,
	view,
})

function handleClick() {
	view.value.data.content = Mock.Random.word(500, 1500)
}
</script>

<template>
	<div :style="rootStyles" @click="handleClick">
		<div ref="contentEl">
			<h1>#{{ props.view.data.index }} Name: {{ props.view.data.name }}</h1>
			<p :style="contentStyles">
				{{ props.view.data.content }}
			</p>
		</div>
	</div>
</template>
