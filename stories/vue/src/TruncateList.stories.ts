import preview from '../.storybook/preview'
import TruncateList from './TruncateList.vue'

const meta = preview.meta({
	title: 'TruncateList',
})

export const Basic = meta.story({
	name: 'Basic',
	render: args => ({
		components: { TruncateList },
		setup: () => ({ args }),
		template: '<TruncateList v-bind="args" />',
	}),
})
