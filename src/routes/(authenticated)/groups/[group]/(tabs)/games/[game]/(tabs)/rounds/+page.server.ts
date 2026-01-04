import { GameRepository } from '$lib/server/repositories/game';
import { RoundRepository } from '$lib/server/repositories/round';
import { Round, type RoundData } from '$lib/domain/round';
import { requireUserOrFail } from '$lib/server/auth/guard';
import { CreateRoundSchema } from '$lib/server/db/schema';
import { SoloType, Team as TeamEnum } from '$lib/domain/enums';
import type { TeamEnumValue as Team, CallTypeEnumValue, BonusTypeEnumValue } from '$lib/domain/enums';
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

function parseCallsFromFormData(formData: FormData): Record<string, { playerId: string; callType: CallTypeEnumValue }[]> {
	const allowedCalls = new Set<CallTypeEnumValue>([CallType.RE, CallType.KONTRA, CallType.Keine90, CallType.Keine60, CallType.Keine30, CallType.Schwarz]);
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
	saveRound: async ({ request, locals, params }: RequestEvent) => {
		const gameId = params.game!;
		const groupId = params.group!;
		const user = requireUserOrFail({ locals });
		const formData = await request.formData();
		const roundId = formData.get('roundId')?.toString() || null;

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
				error: parsed.error.issues[0]?.message || 'Fehler beim Speichern der Runde',
				values: {
					type: formData.get('type'),
					eyesRe: formData.get('eyesRe')
				}
			});
		}

		try {
			const gameRepo = new GameRepository(user.id);
			const roundRepo = new RoundRepository(user.id);
			const game = await gameRepo.getById(gameId, groupId);

			if (!game) {
				return fail(400, {
					error: 'Spiel nicht gefunden',
					values: {}
				});
			}

			const targetRound = roundId ? game.rounds.find((r) => r.id === roundId) : null;
			if (roundId && !targetRound) {
				return fail(400, { error: 'Runde nicht gefunden' });
			}
			if (roundId && targetRound) {
				const wasMandatory = targetRound.soloType === SoloType.Pflicht;
				const willBeMandatory = parsed.data.soloType === SoloType.Pflicht;
				if (wasMandatory !== willBeMandatory) {
					return fail(400, { error: 'Pflichtsoli können nicht in andere Soloarten geändert werden (und umgekehrt).' });
				}
			}

			const teamAssignments = buildTeamAssignments(parsed.data.teams, game);

			const roundDraft: RoundData = {
				id: roundId ?? 'draft',
				roundNumber: targetRound?.roundNumber ?? (game.rounds?.length ? game.rounds.length + 1 : 1),
				type: parsed.data.type,
				soloType: parsed.data.soloType ?? null,
				eyesRe: parsed.data.eyesRe,
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

			const validationError = Round.validate(roundDraft as any, game.withMandatorySolos);
			if (validationError) {
				return fail(400, {
					error: validationError,
					values: { type: parsed.data.type }
				});
			}

			if (game.withMandatorySolos) {
				const existingMandatorySoloPlayers = new Set(
					(game.rounds || [])
						.filter((r) => (!roundId || r.id !== roundId) && r.type.startsWith('SOLO') && r.soloType === SoloType.Pflicht)
						.map((r) => r.participants.find((p) => p.team === TeamEnum.RE)?.playerId)
						.filter(Boolean) as string[]
				);

				const currentSoloPlayer = roundDraft.participants.find((p) => p.team === TeamEnum.RE)?.playerId;
				if (roundDraft.soloType === SoloType.Pflicht) {
					if (!currentSoloPlayer) {
						return fail(400, { error: 'Pflichtsolo benötigt einen Solo-Spieler' });
					}
					if (existingMandatorySoloPlayers.has(currentSoloPlayer)) {
						return fail(400, { error: 'Dieser Spieler hat sein Pflichtsolo bereits gespielt' });
					}
				}
			}

			if (roundId) {
				const updated = await roundRepo.updateRound(roundId, gameId, groupId, roundDraft);
				if (!updated) {
					return fail(400, { error: 'Runde konnte nicht aktualisiert werden' });
				}
			} else {
				const inserted = await roundRepo.addRound(gameId, groupId, roundDraft);
				if (!inserted) {
					return fail(400, { error: 'Runde konnte nicht erstellt werden' });
				}
			}

			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Speichern der Runde',
				values: { type: formData.get('type'), eyesRe: formData.get('eyesRe') }
			});
		}
	}
	,
	finishGame: async ({ locals, params }: RequestEvent) => {
		const gameId = params.game!;
		const groupId = params.group!;
		const user = requireUserOrFail({ locals });

		try {
			const gameRepo = new GameRepository(user.id);
			const game = await gameRepo.getById(gameId, groupId);
			if (!game) {
				return fail(400, { error: 'Spiel nicht gefunden' });
			}

			if (game.withMandatorySolos) {
				const existingMandatorySoloPlayers = new Set(
					(game.rounds || [])
						.filter((r) => r.type.startsWith('SOLO') && r.soloType === SoloType.Pflicht)
						.map((r) => r.participants.find((p) => p.team === TeamEnum.RE)?.playerId)
						.filter(Boolean) as string[]
				);
				const missingMandatorySolos = game.participants.filter(
					(p) => !existingMandatorySoloPlayers.has(p.playerId)
				);
				if (missingMandatorySolos.length > 0) {
					return fail(400, {
						error: 'Spiel kann erst abgeschlossen werden, wenn alle Pflichtsoli gespielt sind'
					});
				}
			}
			const updated = await gameRepo.updateEndTime(gameId, groupId, new Date());

			if (!updated) {
				return fail(400, { error: 'Spiel konnte nicht abgeschlossen werden' });
			}

			return { success: true };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Fehler beim Abschließen des Spiels'
			});
		}
	}
};
