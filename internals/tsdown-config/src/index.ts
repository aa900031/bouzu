import type { ExportsOptions, UserConfig } from 'tsdown'
import * as path from 'node:path'

const customExports: NonNullable<ExportsOptions['customExports']> = (
	exports,
	ctx,
) => {
	const formats = [['import', 'es'], ['require', 'cjs']] as const
	const pkgRoot = path.dirname(ctx.pkg.packageJsonPath)

	for (const [output, config] of Object.entries(exports)) {
		if (config == null || typeof config !== 'object')
			continue
		for (const [name, format] of formats) {
			const configValue = (config as any)[name]
			const chunks = ctx.chunks[format]
			if (typeof configValue !== 'string' || chunks == null)
				continue
			for (const chunk of chunks) {
				if (chunk.type === 'chunk' && chunk.name.endsWith('.d')) {
					(exports as any)[output][name] = {
						default: configValue,
						types: `./${path.relative(pkgRoot, path.join(chunk.outDir, chunk.fileName))}`,
					}
				}
			}
		}
	}

	return exports
}

export const DEFAULT_CONFIG = {
	format: ['esm', 'cjs'],
	clean: true,
	exports: {
		devExports: true,
		customExports,
	},
	dts: {
		compilerOptions: {
			composite: false,
			preserveSymlinks: false,
		},
		tsconfig: './tsconfig.app.json',
	},
} satisfies UserConfig
