<script setup lang="ts" generic="T">
import { useTruncateList } from '@bouzu/vue-truncate-list'
import { toRef, useTemplateRef } from 'vue'

const props = defineProps<{
	data: T[]
}>()

const containerRef = useTemplateRef('container')
const measureRef = useTemplateRef('measure')
const { visibleItems, isOverflowing } = useTruncateList(
	containerRef,
	measureRef,
	{
		items: toRef(props, 'data'),
	},
)
</script>

<template>
	<ul
		ref="container"
		style="
			display: flex;
			overflow: hidden;
			list-style: none;
			column-gap: 15px;
		"
	>
		<li
			v-for="item in visibleItems"
			:key="item"
		>
			<button style="padding: 4px 12px;">
				{{ item }}
			</button>
		</li>
		<button
			v-if="isOverflowing"
			style="padding: 4px 12px;"
		>
			...
		</button>
		<i
			ref="measure"
			style="
				margin-left: -15px;
				flex: 0 1 auto;
				width: 1px;
			"
		/>
	</ul>
</template>
