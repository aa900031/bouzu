import type { Meta, StoryObj } from '@storybook/vue3'
import Zoomable from './Zoomable.vue'
import ZoomableWithSwiper from './ZoomableWithSwiper.vue'

const meta: Meta = {
	title: 'Zoomable',
}

export const Basic: StoryObj<typeof meta> = {
	name: 'Basic',
	render: args => ({
		components: { Zoomable },
		setup: () => ({ args }),
		template: '<Zoomable v-bind="args" />',
	}),
}

export const WithSwiper: StoryObj<typeof meta> = {
	name: 'With Swiper',
	render: args => ({
		components: { ZoomableWithSwiper },
		setup: () => ({ args }),
		template: '<ZoomableWithSwiper v-bind="args" />',
	}),
}

export default meta
