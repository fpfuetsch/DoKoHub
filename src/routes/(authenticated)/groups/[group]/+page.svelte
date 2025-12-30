<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	// Redirect to games tab, preserving the group ID in the URL
	const groupId = $page.params.group;
	goto(`/groups/${groupId}/games`, { replaceHistory: true });
</script>


