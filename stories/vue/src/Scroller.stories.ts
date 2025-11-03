import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Scroller from './Scroller.vue'

const meta: Meta = {
	title: 'Scroller',
	argTypes: {
		visibleByContent: {
			type: 'boolean',
			defaultValue: true,
		},
	},
}

export const Basic: StoryObj<typeof meta> = {
	name: 'Basic',
	render: args => ({
		components: { Scroller },
		setup: () => ({ args }),
		template: '<Scroller v-bind="args" />',
	}),
}

export default meta
