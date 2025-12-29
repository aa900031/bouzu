import type { Preview } from '@storybook/vue3-vite'

import '@unocss/reset/tailwind-compat.css'
import 'uno.css'

export default {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
	},
} satisfies Preview
