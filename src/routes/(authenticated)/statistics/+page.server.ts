import type { ServerLoad } from '@sveltejs/kit';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { getPlayerStatistics } from '$lib/server/statistics/player';

export const load: ServerLoad = async ({ locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });

	const statsPromise = getPlayerStatistics({ principalId: user.id });
	return { statsPromise };
};
