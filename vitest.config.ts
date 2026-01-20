import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			provider: 'istanbul',
			include: [
				'packages/virtualizer/state/**/*.ts',
				'packages/utils/vue-helper/**/*.ts',
			],
		},
		projects: [
			'packages/virtualizer/state',
			'packages/utils/vue-helper',
		],
		outputFile: {
			junit: './reports/junit.xml',
		},
	},
})
