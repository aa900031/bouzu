import { DEFAULT_CONFIG } from '@bouzu/tsdown-config'
import { defineConfig } from 'tsdown'

export default defineConfig({
	...DEFAULT_CONFIG,
	platform: 'neutral',
	entry: [
		'src/index.ts',
	],
})
