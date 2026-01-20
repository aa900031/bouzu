import alias from '@bouzu/vite-config/alias'
import { defineProject } from 'vitest/config'

export default defineProject({
	test: {
		environment: 'happy-dom',
	},
	resolve: {
		alias,
	},
})
