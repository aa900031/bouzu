import preview from '../.storybook/preview'
import Virtualizer from './Virtualizer.vue'

const meta = preview.meta({
	title: 'Virtualizer',
})

export const Basic = meta.story({
	name: 'Basic',
	render: args => ({
		components: { Virtualizer },
		setup: () => ({ args }),
		template: '<Virtualizer v-bind="args" />',
	}),
})
