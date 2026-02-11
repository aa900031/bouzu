import { DEFAULT_CONFIG } from '@bouzu/tsdown-config'
import { defineConfig } from 'tsdown'

export default defineConfig({
	...DEFAULT_CONFIG,
	platform: 'browser',
	entry: [
		'src/index.ts',
	],
	external: [
		'type-fest',
	],
})
