import type { Meta, StoryObj } from '@storybook/vue3-vite'
import Affix from './Affix.vue'
import AffixBottom from './AffixBottom.vue'
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

export const Bottom: StoryObj<typeof meta> = {
	name: 'Bottom',
	render: args => ({
		components: { AffixBottom },
		setup: () => ({ args }),
		template: '<AffixBottom v-bind="args" />',
	}),
}

export default meta
