import preview from '../.storybook/preview'
import Affix from './Affix.vue'
import AffixBottom from './AffixBottom.vue'
import AffixContainer from './AffixContainer.vue'

const meta = preview.meta({
	title: 'Affix',
})

export const Basic = meta.story({
	name: 'Basic',
	render: args => ({
		components: { Affix },
		setup: () => ({ args }),
		template: '<Affix v-bind="args" />',
	}),
})

export const Container = meta.story({
	name: 'Container',
	render: args => ({
		components: { AffixContainer },
		setup: () => ({ args }),
		template: '<AffixContainer v-bind="args" />',
	}),
})

export const Bottom = meta.story({
	name: 'Bottom',
	render: args => ({
		components: { AffixBottom },
		setup: () => ({ args }),
		template: '<AffixBottom v-bind="args" />',
	}),
})
