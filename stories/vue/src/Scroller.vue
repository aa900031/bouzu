<script lang="ts" setup>
import { reactive, ref, toRefs, watch } from 'vue'
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
const info = reactive({
	isScrolling: scrolling.value,
	reach: reach.value,
	axis: axis.value,
	direction: direction.value,
	visibleRect: scroller.visibleRect,
})

watch([viewport], () => {
	scroller.detect()
}, { flush: 'post' })
</script>

<template>
	<div :style="{ position: 'fixed', top: 0, left: 0 }">
		Viewport:
		<input id="viewport-window" v-model="viewport" type="radio" value="window">
		<label for="viewport-window">Window</label>
		<input id="viewport-div" v-model="viewport" type="radio" value="div">
		<label for="viewport-div">Div</label>
	</div>
	<div
		:style="[
			viewport === 'window' ? { display: 'flex', margin: '30px', backgroundColor: 'red' } : {},
			viewport === 'div' ? { display: 'flex', margin: '30px', backgroundColor: 'red', height: '500px', width: '500px', overflow: 'scroll' } : {},
		]"
	>
		<div ref="list" :style="{ flex: '1', margin: '100px 20px 200px 80px', backgroundColor: 'yellow', height: '200vh' }">
			<div :style="{ position: 'fixed', right: 0, bottom: 0 }">
				{{ info }}
			</div>
		</div>
	</div>
</template>
