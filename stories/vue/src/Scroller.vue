<script lang="ts" setup>
import { ref, toRefs, watch } from 'vue'
import { useScrollAxis, useScrollDirection, useScrollOverflow, useScrollReach, useScroller, useScrolling } from '@bouzu/vue-scroller'

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
const overflow = useScrollOverflow(scroller.context)

const height = ref(500)

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

		<template v-if="viewport === 'div'">
			<br>
			<label for="viewport-height">Div Height (px)</label>
			<input id="viewport-height" v-model="height" type="number">
		</template>
	</div>
	<div class="fixed right-0 bottom-0 max-w-1/2 bg-sky-300 p-3">
		<table class="table-fixed">
			<tr>
				<td>isScrolling:</td>
				<td>{{ scrolling.value.value }}</td>
			</tr>
			<tr>
				<td>reach x:</td>
				<td>{{ reach.x.value }}</td>
			</tr>
			<tr>
				<td>reach y:</td>
				<td>{{ reach.y.value }}</td>
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
				<td>overflow x:</td>
				<td>{{ overflow.x.value }}</td>
			</tr>
			<tr>
				<td>overflow y:</td>
				<td>{{ overflow.y.value }}</td>
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
			'w-lg max-w-full overflow-scroll': viewport === 'div',
		}"
		:style="{
			height: viewport === 'div' ? `${height}px` : undefined,
		}"
	>
		<div ref="list" class="flex-1 mt-100px mr-20px mb-200px ml-80px bg-yellow h-3000px" />
	</div>
</template>
