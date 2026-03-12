import type { Round, RoundPoints } from '$lib/domain/round';
import {
	RoundType as RoundTypeEnum,
	SoloType as SoloTypeEnum,
	RoundResult as RoundResultEnum
} from '$lib/domain/enums';

export const resultStyles: Record<RoundResultEnum, string> = {
	[RoundResultEnum.WON]:
		'border-emerald-400 bg-emerald-100 text-black dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100',
	[RoundResultEnum.LOST]:
		'border-rose-400 bg-rose-100 text-black dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-100',
	[RoundResultEnum.DRAW]:
		'border-slate-200 bg-slate-100 text-black dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
};

export const placeholderTile =
	'border-dashed border-slate-200 bg-transparent text-slate-400 dark:border-slate-700 dark:text-slate-400';

export const formatRoundLabel = (round: Round) => {
	if (round.type === RoundTypeEnum.Normal) return 'Normal';
	if (round.type.startsWith('HOCHZEIT')) {
		const variant = round.type.replace('HOCHZEIT_', '').toLowerCase();
		if (variant === 'normal') return 'Hochzeit';
		if (variant === 'still') return 'Stille';
		if (variant === 'ungeklaert') return 'Ungekl\u00e4rt';
		return variant;
	}
	if (round.type.startsWith('SOLO')) {
		const variant = round.type.replace('SOLO_', '').toLowerCase();
		const isPflicht = round.soloType === SoloTypeEnum.Pflicht;
		const soloTypeMap: Record<string, string> = {
			kreuz: 'Kreuz',
			pik: 'Pik',
			herz: 'Herz',
			karo: 'Karo',
			buben: 'Buben',
			damen: 'Damen',
			ass: 'Ass'
		};

		const displayType = soloTypeMap[variant] || variant;
		if (isPflicht) {
			return `${displayType}`;
		}

		return displayType;
	}
	return round.type.replaceAll('_', ' ');
};

export const getPlayerResult = (entry: { points: RoundPoints[] }, playerId: string) =>
	entry.points.find((p) => p.playerId === playerId);
