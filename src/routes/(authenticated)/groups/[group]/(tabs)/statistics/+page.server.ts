import type { ServerLoad } from '@sveltejs/kit';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { getGroupStatistics } from '$lib/server/statistics/group';
import { GameRepository } from '$lib/server/repositories/game';

export const load: ServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const groupId = params.group!;

	// Get finished games count immediately for frontend to decide if showing spinners or alert
	const gameRepo = new GameRepository(user.id);
	const listRes = await gameRepo.listByGroup(groupId);
	const gamesList = listRes.ok ? listRes.value || [] : [];

	const finishedGamesCount = listRes.ok
		? (gamesList || []).filter(
				(g: any) => g && typeof g.isFinished === 'function' && g.isFinished()
			).length
		: 0;

	const statsPromise = getGroupStatistics({ principalId: user.id, groupId });
	return { statsPromise, finishedGamesCount };
};
