import path from 'node:path'

const DIR_PKGS = path.resolve(__dirname, '../packages')

export default {
	'@bouzu/scroller': path.join(DIR_PKGS, './scroller/state/src'),
	'@bouzu/scroller-dom': path.join(DIR_PKGS, './scroller/dom/src'),
	'@bouzu/vue-scroller': path.join(DIR_PKGS, './scroller/vue/src'),
	'@bouzu/vue-helper': path.join(DIR_PKGS, './utils/vue-helper/src'),
	'@bouzu/shared': path.join(DIR_PKGS, './shared/src'),
}
