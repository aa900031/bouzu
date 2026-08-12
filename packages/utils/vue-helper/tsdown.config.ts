import { vue } from '@aa900031/tsdown-config'

export default vue({}, {
	format: ['esm', 'cjs'],
	platform: 'browser',
	external: [
		'type-fest',
	],
})
