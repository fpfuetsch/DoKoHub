import { GameRepository } from '$lib/repositories/game';
import { RoundRepository } from '$lib/repositories/round';
import { Round, type RoundType } from '$lib/domain/round';
import { requireUserOrFail } from '$lib/server/auth/guard';
import { CreateRoundSchema, type TeamEnumValue as Team, type CallTypeEnumValue, type BonusTypeEnumValue } from '$lib/server/db/schema';
import { fail, type RequestEvent, type ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ parent }) => {
	return parent();
};


function parseTeamsFromFormData(formData: FormData): Record<string, string> {
	const teamsObj: Record<string, string> = {};
	for (const [key, value] of formData.entries()) {
		if (key.startsWith('player_') && key.endsWith('_team')) {
			teamsObj[key.replace('_team', '')] = value as string;
		}
	}
	return teamsObj;
}

function parseCallsFromFormData(formData: FormData): Record<string, { playerId: string; callType: CallTypeEnumValue }[]> {
	const allowedCalls = new Set<CallTypeEnumValue>(['RE', 'KONTRA', 'KEINE90', 'KEINE60', 'KEINE30', 'SCHWARZ']);
	const callsObj: Record<string, { playerId: string; callType: CallTypeEnumValue }[]> = {};
	for (const [key, value] of formData.entries()) {
		if (key.startsWith('player_') && key.includes('_call_')) {
			const playerKey = key.replace(/_call_.*/, '');
			if (!allowedCalls.has(value as CallTypeEnumValue)) continue;
			if (!callsObj[playerKey]) {
				callsObj[playerKey] = [];
			}
			callsObj[playerKey].push({ playerId: '', callType: value as CallTypeEnumValue });
		}
	}
	return callsObj;
}

function parseBonusesFromFormData(formData: FormData): Record<string, { playerId: string; bonusType: BonusTypeEnumValue; count: number }[]> {
	const bonusObj: Record<string, { playerId: string; bonusType: BonusTypeEnumValue; count: number }[]> = {};
	for (const [key, value] of formData.entries()) {
		if (key.startsWith('player_') && key.includes('_bonus_')) {
			const playerKey = key.replace(/_bonus_.*/, '');
			const bonusType = key.replace(/player_.*_bonus_/, '') as BonusTypeEnumValue;
			if (!bonusObj[playerKey]) {
				bonusObj[playerKey] = [];
			}
			bonusObj[playerKey].push({ playerId: '', bonusType, count: parseInt(value as string) || 0 });
		}
	}
	return bonusObj;
}

function buildTeamAssignments(
	teams: Record<string, string>,
	game: any
): Map<string, Team> {
	const teamAssignments = new Map<string, Team>();

	for (const [key, team] of Object.entries(teams)) {
		const playerIndex = parseInt(key.replace('player_', ''));
		const participant = game.participants.find((p: any) => p.seatPosition === playerIndex);
		if (participant) {
			teamAssignments.set(participant.playerId, team as Team);
		}
	}

	return teamAssignments;
}

export const actions = {
	addRound: async ({ request, locals, params }: RequestEvent) => {
		const gameId = params.game!;
		const groupId = params.group!;
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const roundRepo = new RoundRepository(user.id);

		const teamsObj = parseTeamsFromFormData(formData);
		const callsObj = parseCallsFromFormData(formData);
		const bonusObj = parseBonusesFromFormData(formData);

		const parsed = CreateRoundSchema.safeParse({
			type: formData.get('type'),
			soloType: formData.get('soloType') || undefined,
			eyesRe: formData.get('eyesRe'),
			teams: teamsObj
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message || 'Fehler beim Erstellen der Runde',
				values: {
					type: formData.get('type'),
					eyesRe: formData.get('eyesRe')
				}
			});
		}

		try {
			const gameRepo = new GameRepository(user.id);
			const game = await gameRepo.getById(gameId, groupId);

			if (!game) {
				return fail(400, {
					error: 'Spiel nicht gefunden',
					values: {}
				});
			}

			const teamAssignments = buildTeamAssignments(parsed.data.teams, game);

			const roundDraft: RoundType = {
				id: 'draft',
				roundNumber: game.rounds?.length ? game.rounds.length + 1 : 1,
				type: parsed.data.type,
				soloType: parsed.data.soloType ?? null,
				eyesRe: parsed.data.eyesRe,
				participants: game.participants.map((p: any) => {
					const playerKey = `player_${p.seatPosition}`;
					return {
						playerId: p.playerId,
						player: p.player,
						team: teamAssignments.get(p.playerId) as Team,
						calls: (callsObj[playerKey] || []).map(c => ({ ...c, playerId: p.playerId })),
						bonuses: (bonusObj[playerKey] || []).map(b => ({ ...b, playerId: p.playerId }))
					};
				})
			};

			const validationError = Round.validate(roundDraft as any);
			if (validationError) {
				return fail(400, {
					error: validationError,
					values: { type: parsed.data.type }
				});
			}

			await roundRepo.addRound(gameId, groupId, roundDraft);

			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Erstellen der Runde',
				values: { type: parsed.data.type }
			});
		}
	}
};
