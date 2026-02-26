<script setup lang="ts">
import { useTruncateList } from '@bouzu/vue-truncate-list'
import { ref, useTemplateRef } from 'vue'

const width = ref(100)

const data = Array.from({ length: 100 }).map((_, i) => i + 1)
const containerRef = useTemplateRef('container')
const measureRef = useTemplateRef('measure')
const { visibleItems, isOverflowing } = useTruncateList<number>({
	containerRef,
	measureRef,
	items: data,
})
</script>

<template>
	<input
		v-model="width"
		min="0"
		max="100"
		type="range"
		style="width: 100%;"
	>
	<ul
		ref="container"
		:style="{
			width: `${width}%`,
		}"
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
				flex: 0 1 auto;
				width: 1px;
			"
		/>
	</ul>
</template>
