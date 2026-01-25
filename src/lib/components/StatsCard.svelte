<script lang="ts">
	import { Card, Spinner } from 'flowbite-svelte';

	export let title: string;
	export let loading = false;
	export let hide = false;
	export let aspect = '5 / 4';
	export let bodyClass = 'flex w-full items-center justify-center';
	export let wrapperClass = '';
</script>

{#if !hide || loading}
	<div class={`w-full p-2 sm:w-1/2 md:w-1/2 lg:w-1/3 xl:w-1/4 2xl:w-1/4 ${wrapperClass}`.trim()}>
		<Card class="h-full p-4 shadow-lg">
			<h3 class="text-md mb-2 font-semibold text-gray-900 dark:text-white">{title}</h3>
			<div class={bodyClass} style={`aspect-ratio: ${aspect};`}>
				{#if loading}
					<Spinner size="12" type="bars" color="primary" />
				{:else}
					<slot />
				{/if}
			</div>
		</Card>
	</div>
{/if}
