import { defineConfig } from 'vite'
import Unocss from 'unocss/vite'
import alias from '../../../.vite/alias'

export default defineConfig({
	plugins: [
		Unocss(),
	],
	resolve: {
		alias: alias
	},
})
