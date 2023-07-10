import type { Meta, StoryObj } from '@storybook/vue3'
import Virtualizer from './Virtualizer.vue'

const meta: Meta = {
	title: 'Virtualizer',
}

export const Basic: StoryObj<typeof meta> = {
	name: 'Basic',
	render: args => ({
		components: { Virtualizer },
		setup: () => ({ args }),
		template: '<Virtualizer v-bind="args" />',
	}),
}

export default meta
