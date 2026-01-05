import { redirect, fail, type RequestEvent } from '@sveltejs/kit';
import { GameRepository } from '$lib/server/repositories/game';
import { requireUserOrFail } from '$lib/server/auth/guard';

export const load = async ({ params }: { params: { group: string; game: string } }) => {
	throw redirect(302, `/groups/${params.group}/games/${params.game}/rounds`);
};

export const actions = {
	finishEarly: async ({ params, locals }: RequestEvent) => {
		const user = requireUserOrFail({ locals });
		const gameId = params.game!;
		const groupId = params.group!;

		try {
			const gameRepo = new GameRepository(user.id);
			const game = await gameRepo.getById(gameId, groupId);

			if (!game) {
				return fail(404, { error: 'Spiel nicht gefunden' });
			}

			if (game.isFinished()) {
				return fail(400, { error: 'Spiel ist bereits beendet' });
			}

			// Mark game as finished by setting endedAt to now
			const updated = await gameRepo.updateEndTime(gameId, groupId, new Date());
			if (!updated) {
				return fail(400, { error: 'Spiel konnte nicht beendet werden' });
			}

			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Beenden des Spiels'
			});
		}
	},

	delete: async ({ params, locals }: RequestEvent) => {
		const user = requireUserOrFail({ locals });
		const gameId = params.game!;
		const groupId = params.group!;

		try {
			const gameRepo = new GameRepository(user.id);
			const deleted = await gameRepo.delete(gameId, groupId);

			if (!deleted) {
				return fail(400, { error: 'Spiel konnte nicht gelöscht werden' });
			}

			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Löschen des Spiels'
			});
		}
	}
};
