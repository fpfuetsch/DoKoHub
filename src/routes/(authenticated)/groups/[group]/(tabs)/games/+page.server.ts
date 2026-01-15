import { GameRepository } from '$lib/server/repositories/game';
import { GroupRepository } from '$lib/server/repositories/group';
import { requireUserOrFail, requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
// input parsing is minimal; validation happens in repositories
import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const groupRepo = new GroupRepository(user.id);
	const groupResult = await groupRepo.getById(params.group);

	if (!groupResult.ok) {
		throw error(groupResult.status, groupResult.error);
	}

	const gameRepo = new GameRepository(user.id);
	const gamesResult = await gameRepo.listByGroup(params.group);

	if (!gamesResult.ok) {
		throw error(gamesResult.status, gamesResult.error);
	}

	return { group: groupResult.value, games: gamesResult.value };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();

		try {
			const gameRepo = new GameRepository(user.id);
			const maxRoundCount = Number(formData.get('maxRoundCount'));
			const withMandatorySolos = (formData.get('withMandatorySolos') as string) === 'true';
			const participantIds = [
				(formData.get('player_0') ?? '').toString(),
				(formData.get('player_1') ?? '').toString(),
				(formData.get('player_2') ?? '').toString(),
				(formData.get('player_3') ?? '').toString()
			];

			// Add 5th player if provided
			const player4 = (formData.get('player_4') ?? '').toString();
			if (player4) {
				participantIds.push(player4);
			}

			const gameResult = await gameRepo.create(
				params.group,
				maxRoundCount,
				withMandatorySolos,
				participantIds
			);

			if (!gameResult.ok) {
				return fail(gameResult.status, { error: gameResult.error });
			}

			return { success: true, gameId: gameResult.value.id };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Erstellen des Spiels.'
			});
		}
	}
};
