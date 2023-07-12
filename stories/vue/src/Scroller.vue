<script lang="ts" setup>
import { ref, toRefs, watch } from 'vue'
import { useScrollAxis, useScrollDirection, useScrollReach, useScroller, useScrolling } from '@bouzu/vue-scroller'

const props = defineProps<{
	visibleByContent?: boolean
	scrollEventPassive?: boolean
}>()

const list = ref<HTMLElement | null>(null)
const viewport = ref('window')
const scroller = useScroller(list, toRefs(props))
const axis = useScrollAxis(scroller.context)
const reach = useScrollReach(scroller.context)
const direction = useScrollDirection(undefined, scroller.context)
const scrolling = useScrolling(scroller.context)

watch([viewport], () => {
	scroller.detect()
}, { flush: 'post' })
</script>

<template>
	<div class="fixed left-0 top-0 bg-sky-300 p-3">
		Viewport: <br>
		<input id="viewport-window" v-model="viewport" type="radio" value="window">
		<label for="viewport-window">Window</label>
		<br>
		<input id="viewport-div" v-model="viewport" type="radio" value="div">
		<label for="viewport-div">Div</label>
	</div>
	<div class="fixed right-0 bottom-0 max-w-1/2 bg-sky-300 p-3">
		<table class="table-fixed">
			<tr>
				<td>isScrolling:</td>
				<td>{{ scrolling.value.value }}</td>
			</tr>
			<tr>
				<td>reach:</td>
				<td>{{ reach.value.value }}</td>
			</tr>
			<tr>
				<td>axis:</td>
				<td>{{ axis.value.value }}</td>
			</tr>
			<tr>
				<td>direction:</td>
				<td>{{ direction.value.value }}</td>
			</tr>
			<tr>
				<td>visibleRect.x:</td>
				<td>{{ scroller.visibleRect.value.x }}</td>
			</tr>
			<tr>
				<td>visibleRect.y:</td>
				<td>{{ scroller.visibleRect.value.y }}</td>
			</tr>
			<tr>
				<td>visibleRect.height:</td>
				<td>{{ scroller.visibleRect.value.height }}</td>
			</tr>
			<tr>
				<td>visibleRect.width:</td>
				<td>{{ scroller.visibleRect.value.width }}</td>
			</tr>
		</table>
	</div>
	<div
		class="flex m-7.5 bg-red"
		:class="{
			'h-lg w-lg max-w-full overflow-scroll': viewport === 'div',
		}"
	>
		<div ref="list" class="flex-1 mt-100px mr-20px mb-200px ml-80px bg-yellow h-200vh" />
	</div>
</template>
