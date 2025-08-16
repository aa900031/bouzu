<script setup lang="ts">
import type { EmblaCarouselType } from 'embla-carousel'
import useEmblaCarousel from 'embla-carousel-vue'
import { ref, shallowRef, unref, watch } from 'vue'
import Zoomable from './components/Zoomable.vue'

const zoomables = ref<(InstanceType<typeof Zoomable>)[] | null>(null)
const activeIndex = shallowRef<number | null>(null)
const prevActiveIndex = shallowRef<number | null>(null)

const [emblaRef, emblaApi] = useEmblaCarousel({
	watchDrag,
})

watch(emblaApi, (api, _, onCleanup) => {
	if (!api)
		return

	api.on('select', handleSelect)
	handleSelect(api)

	onCleanup(() => {
		api.off('select', handleSelect)
	})
}, { immediate: true })

function handleSelect(api: EmblaCarouselType) {
	prevActiveIndex.value = api.previousScrollSnap() ?? null
	activeIndex.value = api.selectedScrollSnap() ?? null
}

function watchDrag(api: EmblaCarouselType, event: TouchEvent | MouseEvent) {
	const _activeIndex = unref(activeIndex)
	if (_activeIndex == null)
		return false

	const zoomable = unref(zoomables)?.[_activeIndex]
	if (!zoomable)
		return false

	const isZoomable = zoomable._.getZoom() === 1
	zoomable._.setEnablePan(!isZoomable)

	return isZoomable
}
</script>

<template>
	<div class="embla">
		<div
			ref="emblaRef"
			class="embla__viewport"
		>
			<div class="embla__container">
				<div
					v-for="i in 5"
					:key="i"
					class="embla__slide"
				>
					<Zoomable
						ref="zoomables"
						class="w-full h-full"
						:disabled="activeIndex !== (i - 1)"
					>
						<div
							class="
								w-[400px] h-[300px] rounded-3 flex flex-col justify-center items-center text-white text-lg font-bold cursor-grab
								[background:linear-gradient(45deg,#ff6b6b,#4ecdc4,#45b7d1,#96ceb4)]
								shadow-[0_8px_32px_rgba(0,0,0,0.1)]
								[text-shadow:2px_2px_4px_rgba(0,0,0,0.3)]
							"
						>
							<div class="text-center">
								<h2 class="m-0 mb-2.5">
									🎯 縮放組件演示
								</h2>
								<p class="m-0">
									雙指捏合或 Ctrl+滾輪縮放
								</p>
								<p class="m-0 mt-1">
									拖曳或滾輪移動內容
								</p>
								<p class="m-0 mt-1 text-sm opacity-80">
									雙擊切換縮放
								</p>
							</div>
						</div>
					</Zoomable>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.embla {
  max-width: 48rem;
  margin: auto;
  --slide-height: 19rem;
  --slide-spacing: 1rem;
  --slide-size: 100%;
}
.embla__viewport {
  overflow: hidden;
	background: gray;
}
.embla__container {
  display: flex;
  touch-action: pan-y pinch-zoom;
  margin-left: calc(var(--slide-spacing) * -1);
}
.embla__slide {
  transform: translate3d(0, 0, 0);
  flex: 0 0 var(--slide-size);
  min-width: 0;
  padding-left: var(--slide-spacing);
}
.embla__slide__number {
	background: red;
  box-shadow: inset 0 0 0 0.2rem var(--detail-medium-contrast);
  border-radius: 1.8rem;
  font-size: 4rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
</style>
