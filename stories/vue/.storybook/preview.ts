/* eslint-disable perfectionist/sort-imports */
import '@unocss/reset/tailwind-compat.css'
import 'uno.css'
import { definePreview } from '@storybook/vue3-vite'

export default definePreview({
	addons: [],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
	},
})
