import { redirect, fail, type RequestEvent } from '@sveltejs/kit';
import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const load = async ({ params }: { params: { group: string; game: string } }) => {
	throw redirect(302, `/groups/${params.group}/games/${params.game}/rounds`);
};

export const actions = {
	finish: async ({ params, locals }: RequestEvent) => {
		const user = requireUserOrFail({ locals });
		const gameId = params.game!;
		const groupId = params.group!;

		const gameRepo = new GameRepository(user.id);
		const result = await gameRepo.finish(gameId, groupId, new Date());

		if (!result.ok) {
			return fail(result.status, { error: result.error });
		}

		return { success: true };
	},

	delete: async ({ params, locals }: RequestEvent) => {
		const user = requireUserOrFail({ locals });
		const gameId = params.game!;
		const groupId = params.group!;

		const gameRepo = new GameRepository(user.id);
		const result = await gameRepo.delete(gameId, groupId);

		if (!result.ok) {
			return fail(result.status, { error: result.error });
		}

		return { success: true };
	}
};
