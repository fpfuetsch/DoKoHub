import { GameRepository } from '$lib/repositories/game';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const gameRepo = new GameRepository(user.id);
	const game = await gameRepo.getById(params.game, params.group);

	if (!game) {
		throw new Error('Game not found');
	}

	return { game };
};
