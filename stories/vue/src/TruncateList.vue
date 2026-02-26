<script setup lang="ts">
import TruncateList from './components/TruncateList.vue'

const data = [
	1,
	2,
	3,
	4,
	5,
]
</script>

<template>
	<div>
		<TruncateList
			style="width: 500px;"
			:data="data"
		>
			<template #default="{ item }">
				<button style="min-width: 160;">
					{{ item }}
				</button>
			</template>
		</TruncateList>
	</div>
</template>
