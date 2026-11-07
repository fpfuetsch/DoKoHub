import type { ServerLoad } from '@sveltejs/kit';
import { requireUserOrRedirectToLogin } from '#lib/server/auth/guard.js';
import { getGameStatistics } from '#lib/server/statistics/game.js';

export const load: ServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const gameId = params.game!;
	const groupId = params.group!;

	// Return statistics promise without awaiting for streaming
	const statsPromise = getGameStatistics({
		principalId: user.id,
		gameId,
		groupId
	});

	return {
		statsPromise
	};
};
