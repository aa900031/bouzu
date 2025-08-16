<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/navigation'
import { Navigation } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper/types'
import { computed, nextTick, ref, unref } from 'vue'
import Zoomable from './components/Zoomable.vue'

const modules = [
	Navigation,
]

const prevActiveIndex = ref<number | null>(null)
const activeIndex = ref<number | null>(null)
const zoomables = ref<(InstanceType<typeof Zoomable>)[]>([])
const zoomable = computed(() => {
	const _activeIndex = unref(activeIndex)
	if (_activeIndex == null)
		return null
	return unref(zoomables)[_activeIndex] ?? null
})
const prevZoomable = computed(() => {
	const _prevActiveIndex = unref(prevActiveIndex)
	if (_prevActiveIndex == null)
		return null
	return unref(zoomables)[_prevActiveIndex] ?? null
})

function handleTouchStart(swiper: SwiperInstance, event: PointerEvent | MouseEvent | TouchEvent) {
	const _zoomable = unref(zoomable)
	if (!_zoomable)
		return

	if (_zoomable._.getZoom() !== 1)
		swiper.allowTouchMove = false
	else
		event.preventDefault()
}

function handleTouchMove(swiper: SwiperInstance, event: PointerEvent | MouseEvent | TouchEvent) {
	const _zoomable = unref(zoomable)
	if (!_zoomable)
		return

	if (_zoomable._.getZoom() !== 1)
		swiper.allowTouchMove = false
	else
		event.preventDefault()
}

function handleTouchEnd(swiper: SwiperInstance, _event: PointerEvent | MouseEvent | TouchEvent) {
	swiper.allowTouchMove = true
}

function handleSlideChange(swiper: SwiperInstance) {
	prevActiveIndex.value = unref(activeIndex)
	activeIndex.value = swiper.activeIndex
	nextTick(() => {
		unref(prevZoomable)?._.reset()
	})
}

function handleInit(swiper: SwiperInstance) {
	activeIndex.value = swiper.activeIndex
}
</script>

<template>
	<Swiper
		:touch-start-prevent-default="false"
		:navigation="true"
		:modules="modules"
		@touch-start="handleTouchStart"
		@touch-move="handleTouchMove"
		@touch-end="handleTouchEnd"
		@slide-change="handleSlideChange"
		@after-init="handleInit"
	>
		<SwiperSlide
			v-for="i in 5"
			:key="i"
		>
			<Zoomable
				ref="zoomables"
				class="w-full h-full"
				:disabled="!(activeIndex === i - 1)"
			>
				<div class="w-56 h-55 bg-red">
					Swiper {{ i }}
				</div>
			</Zoomable>
		</SwiperSlide>
	</Swiper>
</template>

<style>
.swiper {
  width: 600px;
  height: 400px;
}

.swiper-slide {
  text-align: center;
  font-size: 18px;
  background: #444;

  /* Center slide text vertically */
  display: flex;
  justify-content: center;
  align-items: center;
}

.swiper-slide img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
