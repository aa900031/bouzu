<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue'
import 'swiper/css'
import 'swiper/css/navigation'
import { Navigation } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper/types'
import { ref, shallowRef, unref } from 'vue'
import Zoomable from './components/Zoomable.vue'

const modules = [
	Navigation,
]

const zoomables = ref<(InstanceType<typeof Zoomable>)[]>([])
const zoomable = shallowRef<InstanceType<typeof Zoomable> | null>(null)
const prevZoomable = shallowRef<InstanceType<typeof Zoomable> | null>(null)

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

function handleTouchEnd(swiper: SwiperInstance, event: PointerEvent | MouseEvent | TouchEvent) {
	swiper.allowTouchMove = true
}

function handleSlideChange(swiper: SwiperInstance) {
	prevZoomable.value = zoomable.value
	zoomable.value = unref(zoomables)[swiper.activeIndex]
}

function handleSlideAfterChange(swiper: SwiperInstance) {
	const _prevZoomable = unref(prevZoomable)
	if (_prevZoomable != null)
		_prevZoomable._.reset()
}

function handleInit(swiper: SwiperInstance) {
	zoomable.value = unref(zoomables)[swiper.activeIndex]
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
		@slide-change-transition-end="handleSlideAfterChange"
		@after-init="handleInit"
	>
		<SwiperSlide
			v-for="i in 5"
			:key="i"
		>
			<Zoomable
				ref="zoomables"
				class="w-full h-full"
			>
				<div class="w-56 h-55 bg-red">
					Swiper {{ i + 1 }}
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
