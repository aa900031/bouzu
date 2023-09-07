import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
	entries: [
		'src/index',
	],
	declaration: true,
	clean: true,
	rollup: {
		emitCJS: true,
		dts: {
			respectExternal: true,
			compilerOptions: {
				composite: false,
				preserveSymlinks: false,
			},
			tsconfig: './tsconfig.app.json',
		},
	},
})
