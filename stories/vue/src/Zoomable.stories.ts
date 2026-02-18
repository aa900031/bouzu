import preview from '../.storybook/preview'
import Zoomable from './Zoomable.vue'
import ZoomableWithSwiper from './ZoomableWithSwiper.vue'

const meta = preview.meta({
	title: 'Zoomable',
})

export const Basic = meta.story({
	name: 'Basic',
	render: args => ({
		components: { Zoomable },
		setup: () => ({ args }),
		template: '<Zoomable v-bind="args" />',
	}),
})

export const WithSwiper = meta.story({
	name: 'With Swiper',
	render: args => ({
		components: { ZoomableWithSwiper },
		setup: () => ({ args }),
		template: '<ZoomableWithSwiper v-bind="args" />',
	}),
})
