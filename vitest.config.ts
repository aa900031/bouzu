import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		coverage: {
			provider: 'istanbul',
			include: [
				'packages/**/src/**/*',
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
