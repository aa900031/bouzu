<script setup lang="ts" generic="T">
import { useTruncateList } from '@bouzu/vue-truncate-list'
import { toRef, useTemplateRef } from 'vue'

const props = defineProps<{
	data: T[]
}>()

const containerRef = useTemplateRef('container')
const measureRef = useTemplateRef('measure')
const { visibleItems, overflowItems, isOverflowing } = useTruncateList<T>({
	containerRef,
	measureRef,
	items: toRef(() => props.data),
})
</script>

<template>
	<ul
		ref="container"
		style="
			display: flex;
			align-items: center;
			overflow: hidden;
			list-style: none;
		"
	>
		<li
			v-for="item in visibleItems"
			:key="(item as any)"
		>
			<slot :item="item" />
		</li>
		<slot
			v-if="isOverflowing"
			name="others"
			:visible-items="visibleItems"
			:overflow-items="overflowItems"
		/>
		<i
			ref="measure"
			style="
				flex: 0 1 auto;
				width: 1px;
			"
		/>
	</ul>
</template>
