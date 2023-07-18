<script lang="ts" setup>
import Mock from 'mockjs'
import type { StyleValue } from 'vue'
import { computed, ref } from 'vue'
import { useVirtualList } from '@bouzu/vue-virtualizer'
import VirtualizerItem from './VirtualizerItem.vue'

interface Item {
	id: string
	name: string
	content: string
}

console.time('gen rawData')
const rawData: Item[] = Array.from({ length: 1000 }, (_, i) => ({
	index: i,
	id: Mock.Random.guid(),
	name: Mock.Random.name(),
	content: Mock.Random.word(500, 1500),
}))
console.timeEnd('gen rawData')

const el = ref<HTMLElement | null>(null)
const data = ref<Item[]>(rawData)
const {
	visibleViews,
	contentSize,
	isScrolling,
} = useVirtualList<Item>({ el, data })

const contentStyles = computed<StyleValue>(() => ({
	width: contentSize.value.width === 0 ? 'auto' : `${contentSize.value.width}px`,
	height: contentSize.value.height === 0 ? 'auto' : `${contentSize.value.height}px`,
	pointerEvents: isScrolling.value ? 'none' : 'auto',
}))

function handleItemClick(index: number) {
	data.value[index].content = Mock.Random.word(500, 1500)
}
</script>

<template>
	<div ref="el" class="m-5 relative bg-zinc-300">
		<div :style="contentStyles">
			<VirtualizerItem
				v-for="view in visibleViews"
				:key="view.key"
				:view="view"
				@click="handleItemClick"
			/>
		</div>
	</div>
</template>
