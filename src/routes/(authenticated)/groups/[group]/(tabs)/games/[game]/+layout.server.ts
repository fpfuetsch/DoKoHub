import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const gameRepo = new GameRepository(user.id);
	const game = await gameRepo.getById(params.game, params.group);

	if (!game) {
		throw error(404, 'Spiel nicht gefunden');
	}

	return { game };
};
