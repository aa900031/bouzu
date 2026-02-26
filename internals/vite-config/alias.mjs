import { fileURLToPath, URL } from 'node:url'

export default {
	'@bouzu/vue-helper': fileURLToPath(new URL('../../packages/utils/vue-helper/src', import.meta.url)),
	'@bouzu/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),

	'@bouzu/scroller': fileURLToPath(new URL('../../packages/scroller/state/src', import.meta.url)),
	'@bouzu/scroller-dom': fileURLToPath(new URL('../../packages/scroller/dom/src', import.meta.url)),
	'@bouzu/vue-scroller': fileURLToPath(new URL('../../packages/scroller/vue/src', import.meta.url)),

	'@bouzu/virtualizer': fileURLToPath(new URL('../../packages/virtualizer/state/src', import.meta.url)),
	'@bouzu/virtualizer-dom': fileURLToPath(new URL('../../packages/virtualizer/dom/src', import.meta.url)),
	'@bouzu/vue-virtualizer': fileURLToPath(new URL('../../packages/virtualizer/vue/src', import.meta.url)),

	'@bouzu/zoomable': fileURLToPath(new URL('../../packages/zoomable/state/src', import.meta.url)),
	'@bouzu/zoomable-dom': fileURLToPath(new URL('../../packages/zoomable/dom/src', import.meta.url)),
	'@bouzu/vue-zoomable': fileURLToPath(new URL('../../packages/zoomable/vue/src', import.meta.url)),

	'@bouzu/affix': fileURLToPath(new URL('../../packages/affix/state/src', import.meta.url)),
	'@bouzu/affix-dom': fileURLToPath(new URL('../../packages/affix/dom/src', import.meta.url)),
	'@bouzu/vue-affix': fileURLToPath(new URL('../../packages/affix/vue/src', import.meta.url)),

	'@bouzu/truncate-list': fileURLToPath(new URL('../../packages/truncate-list/state/src', import.meta.url)),
}
