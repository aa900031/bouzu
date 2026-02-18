import { defineMain } from '@storybook/vue3-vite/node'

export default defineMain({
	stories: [
		'../src/**/*.mdx',
		'../src/**/*.stories.@(js|jsx|ts|tsx)',
	],
	addons: [
		'@storybook/addon-links',
		'@storybook/addon-docs',
	],
	framework: {
		name: '@storybook/vue3-vite',
		options: {
			docgen: false,
		},
	},
})
