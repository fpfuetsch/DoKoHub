<script lang="ts">
	import { BottomNav, BottomNavItem } from 'flowbite-svelte';
	import { UsersGroupSolid, ChartOutline, UserCircleSolid } from 'flowbite-svelte-icons';
	import { page } from '$app/state';

	let activeUrl = $derived(page.url.pathname);
	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<div class="flex flex-1 flex-col">
		<header class="bg-light shadow-sm">
			<div class="text-primary top-0 z-30 flex h-16 items-center px-2">
				<h1 class="flex-1 truncate text-center text-3xl font-semibold">DoKoHub</h1>
			</div>
		</header>
		<div class="flex-1 overflow-auto p-4 pb-24">
			{@render children()}
		</div>
	</div>
	<div class="sticky bottom-0 w-full">
		<BottomNav {activeUrl} position="absolute" classes={{ inner: 'grid-cols-3' }}>
			<BottomNavItem btnName="Gruppen" href="/groups">
				<UsersGroupSolid
					class="mb-1 h-6 w-6 text-gray-500 group-hover:text-primary-600 dark:text-gray-400 dark:group-hover:text-primary-500"
				/>
			</BottomNavItem>
			<BottomNavItem btnName="Statistiken" href="/statistics">
				<ChartOutline
					class="mb-1 h-6 w-6 text-gray-500 group-hover:text-primary-600 dark:text-gray-400 dark:group-hover:text-primary-500"
				/>
			</BottomNavItem>
			<BottomNavItem btnName="Profil" href="/profile">
				<UserCircleSolid
					class="mb-1 h-6 w-6 text-gray-500 group-hover:text-primary-600 dark:text-gray-400 dark:group-hover:text-primary-500"
				/>
			</BottomNavItem>
		</BottomNav>
	</div>
</div>
