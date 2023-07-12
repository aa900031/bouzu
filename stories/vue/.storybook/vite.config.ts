import { defineConfig } from 'vite'
import alias from '../../../.vite/alias'

export default defineConfig({
	resolve: {
		alias: alias
	},
})
