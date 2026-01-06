<script lang="ts">
	import {
		LineChart
	} from 'layerchart';
	import { Card } from 'flowbite-svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();

	// Color palette for different players
	const playerColors: Record<string, string> = {
		'#ef562f': '#ef562f',
		'#0284c7': '#0284c7',
		'#16a34a': '#16a34a',
		'#eab308': '#eab308'
	};

	// Create color assignments for each player
	const colors = Object.values(playerColors);
</script>

<div class="p-4 sm:p-6">
	<div class="mx-auto max-w-5xl">
		<!-- Simple flex row with wrapping and centered items -->
		<div class="mx-auto flex flex-wrap justify-center gap-2">
			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-4 text-xl font-bold text-gray-900 dark:text-white">Punktentwicklung</h3>

					<div
						class=" h-96 rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50"
					>
						<LineChart
							data={data?.chart?.rows ?? []}
							x="round"
							series={data?.chart?.series ?? []}
							padding={{ top: 20, right: 20, bottom: 50, left: 20 }}
							legend
						/>
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-3 text-lg font-bold text-gray-900 dark:text-white">Gewinnrate</h3>
					<div class="flex h-48 items-center justify-center text-gray-400">
						<p>Chart or stats coming soon</p>
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-3 text-lg font-bold text-gray-900 dark:text-white">Total Spiele</h3>
					<div class="flex h-48 items-center justify-center text-gray-400">
						<p>Content here</p>
					</div>
				</Card>
			</div>

			<div class="w-full sm:w-80 md:w-90 lg:w-100">
				<Card class="h-full p-4 shadow-lg">
					<h3 class="mb-3 text-lg font-bold text-gray-900 dark:text-white">Durchschnitt</h3>
					<div class="flex h-48 items-center justify-center text-gray-400">
						<p>Content here</p>
					</div>
				</Card>
			</div>
		</div>
	</div>
</div>
