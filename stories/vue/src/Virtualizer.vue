<script lang="ts">
import Mock from 'mockjs'
</script>

<script lang="ts" setup>
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
const rootStyles = computed(() => ({
	margin: '20px',
	backgroundColor: 'lightgray',
	position: 'relative',
}))
const contentStyles = computed(() => ({
	width: contentSize.value.width === 0 ? 'auto' : `${contentSize.value.width}px`,
	height: contentSize.value.height === 0 ? 'auto' : `${contentSize.value.height}px`,
	pointerEvents: isScrolling.value ? 'none' : 'auto',
}))
</script>

<template>
	<div ref="el" :style="rootStyles">
		<div :style="contentStyles">
			<VirtualizerItem
				v-for="view in visibleViews"
				:key="view.key"
				:view="view"
			/>
		</div>
	</div>
</template>
