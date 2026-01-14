import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const gameRepo = new GameRepository(user.id);
	const gameResult = await gameRepo.getById(params.game, params.group);

	if (!gameResult.ok) {
		throw error(gameResult.status, gameResult.error);
	}

	return { game: gameResult.value };
};
