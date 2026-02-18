import preview from '../.storybook/preview'
import Scroller from './Scroller.vue'

const meta = preview.meta({
	title: 'Scroller',
	argTypes: {
		visibleByContent: {
			type: 'boolean',
			defaultValue: true,
		},
	},
})

export const Basic = meta.story({
	name: 'Basic',
	render: args => ({
		components: { Scroller },
		setup: () => ({ args }),
		template: '<Scroller v-bind="args" />',
	}),
})
