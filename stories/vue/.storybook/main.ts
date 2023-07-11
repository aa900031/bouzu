import { mergeAlias } from 'vite'
import type { StorybookConfig } from '@storybook/vue3-vite'
import alias from '../../../.vite/alias'

export default {
	stories: [
		'../src/**/*.mdx',
		'../src/**/*.stories.@(js|jsx|ts|tsx)'
	],
	addons: [
		'@storybook/addon-links',
		'@storybook/addon-essentials',
		'@storybook/addon-interactions',
	],
	framework: {
		name: '@storybook/vue3-vite',
		options: {},
	},
	docs: {
		autodocs: 'tag',
	},
	viteFinal: (config) => {
		((config ??= {}).resolve ??= {}).alias = mergeAlias(config.resolve.alias, alias)

		return config
	}
} satisfies StorybookConfig
