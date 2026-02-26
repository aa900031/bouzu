<script setup lang="ts" generic="T">
import { useTruncateList } from '@bouzu/vue-truncate-list'
import { toRef, useTemplateRef } from 'vue'

const props = defineProps<{
	data: T[]
}>()

const containerRef = useTemplateRef('container')
const measureRef = useTemplateRef('measure')
const { visibleItems } = useTruncateList<T>({
	containerRef,
	measureRef,
	items: toRef(() => props.data),
})
</script>

<template>
	<ul style="list-style: none;">
		<li
			v-for="item in visibleItems"
			:key="(item as any)"
		>
			<slot :item="item" />
		</li>
	</ul>
</template>
