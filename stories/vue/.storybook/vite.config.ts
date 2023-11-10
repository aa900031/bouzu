import { defineConfig } from 'vite'
import Unocss from 'unocss/vite'
import alias from '@bouzu/vite-config/alias'

export default defineConfig({
	plugins: [
		Unocss(),
	],
	resolve: {
		alias,
	},
})
