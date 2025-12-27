import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Affix from './Affix.vue'
import AffixContainer from './AffixContainer.vue'

const meta: Meta = {
	title: 'Affix',
}

export const Basic: StoryObj<typeof meta> = {
	name: 'Basic',
	render: args => ({
		components: { Affix },
		setup: () => ({ args }),
		template: '<Affix v-bind="args" />',
	}),
}

export const Container: StoryObj<typeof meta> = {
	name: 'Container',
	render: args => ({
		components: { AffixContainer },
		setup: () => ({ args }),
		template: '<AffixContainer v-bind="args" />',
	}),
}

export default meta
