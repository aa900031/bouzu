import alias from '@bouzu/vite-config/alias'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'happy-dom',
	},
	resolve: {
		alias,
	},
})
