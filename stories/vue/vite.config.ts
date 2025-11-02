import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'

const DIR_PKGS = fileURLToPath(new URL('../../packages', import.meta.url))

export default defineConfig(env => ({
	plugins: [
		Unocss(),
		Vue(),
	],
	resolve: {
		alias: env.mode !== 'production'
			? {
					'@bouzu/scroller': path.join(DIR_PKGS, './scroller/state/src'),
					'@bouzu/scroller-dom': path.join(DIR_PKGS, './scroller/dom/src'),
					'@bouzu/vue-scroller': path.join(DIR_PKGS, './scroller/vue/src'),
					'@bouzu/virtualizer': path.join(DIR_PKGS, './virtualizer/state/src'),
					'@bouzu/virtualizer-dom': path.join(DIR_PKGS, './virtualizer/dom/src'),
					'@bouzu/vue-virtualizer': path.join(DIR_PKGS, './virtualizer/vue/src'),
					'@bouzu/vue-helper': path.join(DIR_PKGS, './utils/vue-helper/src'),
					'@bouzu/shared': path.join(DIR_PKGS, './shared/src'),
					'@bouzu/zoomable': path.join(DIR_PKGS, './zoomable/state/src'),
					'@bouzu/zoomable-dom': path.join(DIR_PKGS, './zoomable/dom/src'),
					'@bouzu/vue-zoomable': path.join(DIR_PKGS, './zoomable/vue/src'),
				}
			: undefined,
	},
}))
