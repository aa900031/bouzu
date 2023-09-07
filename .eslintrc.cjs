/** @types {import('eslint').Linter.Config} */
module.exports = {
	extends: [
		'@aa900031',
	],
	overrides: [
		{
			files: [
				'*.{js,ts,vue}',
			],
			excludedFiles: '**/src/**/*',
			rules: {
				'no-import-assign': 'off',
			},
		},
	],
}
