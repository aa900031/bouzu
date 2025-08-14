import type { Meta, StoryObj } from '@storybook/vue3'
import Zoomable from './Zoomable.vue'

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

export default meta
