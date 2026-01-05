import { GameRepository } from '$lib/server/repositories/game';
import { GroupRepository } from '$lib/server/repositories/group';
import { requireUserOrFail, requireUserOrRedirectToLogin } from '$lib/server/auth/guard';
import { CreateGameSchema, GroupNameSchema } from '$lib/server/db/schema';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	const groupRepo = new GroupRepository(user.id);
	const group = await groupRepo.getById(params.group);

	if (!group) {
		throw new Error('Group not found');
	}

	const gameRepo = new GameRepository(user.id);
	const games = await gameRepo.listByGroup(params.group);

	return { group, games };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();

		const parsed = CreateGameSchema.safeParse({
			maxRoundCount: formData.get('maxRoundCount'),
			withMandatorySolos: formData.get('withMandatorySolos'),
			player_0: formData.get('player_0'),
			player_1: formData.get('player_1'),
			player_2: formData.get('player_2'),
			player_3: formData.get('player_3')
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message || 'Fehler beim Erstellen des Spiels',
				values: {
					maxRoundCount: formData.get('maxRoundCount'),
					withMandatorySolos: formData.get('withMandatorySolos')
				}
			});
		}

		try {
			const gameRepo = new GameRepository(user.id);
			const participantIds = [
				parsed.data.player_0,
				parsed.data.player_1,
				parsed.data.player_2,
				parsed.data.player_3
			];

			// Check for duplicate players
			const uniqueIds = new Set(participantIds);
			if (uniqueIds.size !== 4) {
				return fail(400, {
					error: 'Jeder Spieler darf nur einmal ausgewählt werden',
					values: {
						maxRoundCount: parsed.data.maxRoundCount,
						withMandatorySolos: parsed.data.withMandatorySolos
					}
				});
			}

			const game = await gameRepo.create(
				params.group,
				parsed.data.maxRoundCount,
				parsed.data.withMandatorySolos,
				participantIds
			);

			if (!game) {
				return fail(400, {
					error: 'Konnte das Spiel nicht erstellen',
					values: {
						maxRoundCount: parsed.data.maxRoundCount,
						withMandatorySolos: parsed.data.withMandatorySolos
					}
				});
			}

			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Erstellen des Spiels',
				values: {
					maxRoundCount: parsed.data.maxRoundCount,
					withMandatorySolos: parsed.data.withMandatorySolos
				}
			});
		}
	},
	rename: async ({ request, params, locals }) => {
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const newName = formData.get('name')?.toString() || '';

		const parsed = GroupNameSchema.safeParse(newName);
		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message || 'Ungültiger Gruppenname'
			});
		}

		try {
			const repo = new GroupRepository(user.id);
			const updated = await repo.updateName(params.group!, parsed.data);
			if (!updated) {
				return fail(400, { error: 'Gruppe konnte nicht aktualisiert werden' });
			}
			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Aktualisieren der Gruppe'
			});
		}
	},

	deleteGroup: async ({ params, locals }) => {
		const user = requireUserOrFail({ locals });

		try {
			const repo = new GroupRepository(user.id);
			const deleted = await repo.delete(params.group!);
			if (!deleted) {
				return fail(400, { error: 'Gruppe konnte nicht gelöscht werden' });
			}
			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Löschen der Gruppe'
			});
		}
	}
};
