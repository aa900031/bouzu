<script setup lang="ts">
import { ref } from 'vue'
import TruncateList from './components/TruncateList.vue'

const data = Array.from({ length: 100 }).map((_, i) => i + 1)
const width = ref(100)
</script>

<template>
	<input
		v-model="width"
		min="0"
		max="100"
		type="range"
		style="width: 100%;"
	>
	<TruncateList
		:style="{
			width: `${width}%`,
		}"
		:data="data"
	/>
</template>
