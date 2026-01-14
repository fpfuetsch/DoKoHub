import { GameRepository } from '$lib/server/repositories/game';
import { RoundRepository } from '$lib/server/repositories/round';
import { Round, type RoundData } from '$lib/domain/round';
import { Game } from '$lib/domain/game';
import { requireUserOrFail } from '$lib/server/auth/guard';
import { SoloType, Team as TeamEnum } from '$lib/domain/enums';
import type {
	TeamEnumValue as Team,
	CallTypeEnumValue,
	BonusTypeEnumValue
} from '$lib/domain/enums';
import { CallType } from '$lib/server/enums';
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

function parseCallsFromFormData(
	formData: FormData
): Record<string, { playerId: string; callType: CallTypeEnumValue }[]> {
	const allowedCalls = new Set<CallTypeEnumValue>([
		CallType.RE,
		CallType.KONTRA,
		CallType.Keine90,
		CallType.Keine60,
		CallType.Keine30,
		CallType.Schwarz
	]);
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

function parseBonusesFromFormData(
	formData: FormData
): Record<string, { playerId: string; bonusType: BonusTypeEnumValue; count: number }[]> {
	const bonusObj: Record<
		string,
		{ playerId: string; bonusType: BonusTypeEnumValue; count: number }[]
	> = {};
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

function buildTeamAssignments(teams: Record<string, string>, game: any): Map<string, Team> {
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
	save: async ({ request, locals, params }: RequestEvent) => {
		const user = requireUserOrFail({ locals });
		const gameId = params.game!;
		const groupId = params.group!;
		const formData = await request.formData();
		const roundId = formData.get('roundId')?.toString() || null;

		const teamsObj = parseTeamsFromFormData(formData);
		const callsObj = parseCallsFromFormData(formData);
		const bonusObj = parseBonusesFromFormData(formData);

		const gameRepo = new GameRepository(user.id);
		const roundRepo = new RoundRepository(user.id);
		const gameResult = await gameRepo.getById(gameId, groupId);

		if (!gameResult.ok) {
			return fail(gameResult.status, {
				error: gameResult.error,
				values: {}
			});
		}

		const game = gameResult.value;

		const targetRound = roundId ? game.rounds.find((r) => r.id === roundId) : null;
		if (roundId && !targetRound) {
			return fail(400, { error: 'Runde nicht gefunden.' });
		}

		const teamAssignments = buildTeamAssignments(teamsObj, game);

		const roundDraft: RoundData = {
			id: roundId ?? 'draft',
			roundNumber: targetRound?.roundNumber ?? (game.rounds?.length ? game.rounds.length + 1 : 1),
			type: formData.get('type') as any,
			soloType: (formData.get('soloType') as any) || null,
			eyesRe: Number(formData.get('eyesRe')),
			participants: game.participants.map((p: any) => {
				const playerKey = `player_${p.seatPosition}`;
				return {
					playerId: p.playerId,
					player: p.player,
					team: teamAssignments.get(p.playerId) as Team,
					calls: (callsObj[playerKey] || []).map((c) => ({ ...c, playerId: p.playerId })),
					bonuses: (bonusObj[playerKey] || []).map((b) => ({ ...b, playerId: p.playerId }))
				};
			})
		};

		if (roundId) {
			const updated = await roundRepo.updateRound(roundId, gameId, groupId, roundDraft);
			if (!updated.ok) {
				return fail(updated.status, { error: updated.error });
			}
		} else {
			const inserted = await roundRepo.addRound(gameId, groupId, roundDraft);
			if (!inserted.ok) {
				return fail(inserted.status, { error: inserted.error });
			}
		}

		return { success: true };
	}
};
