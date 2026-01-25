import { RoundType } from '$lib/domain/enums';
import { generateDistinctColorPalette } from '$lib/utils/colors';

// Shared round type palette
export const roundTypeColorPalette = ['#3b82f6', '#10b981', '#f59e0b'];

// Shared solo type order and labels
export const soloTypeOrder = [
	RoundType.SoloBuben,
	RoundType.SoloDamen,
	RoundType.SoloAss,
	RoundType.SoloKreuz,
	RoundType.SoloPik,
	RoundType.SoloHerz,
	RoundType.SoloKaro,
	RoundType.HochzeitStill,
	RoundType.HochzeitUngeklaert
];

export const soloTypeLabels: Partial<Record<RoundType, string>> = {
	[RoundType.SoloBuben]: 'Bube',
	[RoundType.SoloDamen]: 'Dame',
	[RoundType.SoloAss]: 'Ass',
	[RoundType.SoloKreuz]: '♣️',
	[RoundType.SoloPik]: '♠️',
	[RoundType.SoloHerz]: '♥️',
	[RoundType.SoloKaro]: '♦️',
	[RoundType.HochzeitStill]: 'Stille',
	[RoundType.HochzeitUngeklaert]: 'Ungeklärt'
};

// Derived solo type colors (stable order)
const soloTypePalette = generateDistinctColorPalette(soloTypeOrder.length);
export const soloTypeColors: Partial<Record<RoundType, string>> = {};
soloTypeOrder.forEach((type, idx) => {
	soloTypeColors[type] = soloTypePalette[idx];
});

// Shared call/bonus series definitions
export const callSeries = [
	{ key: 'RE', label: 'Re', color: 'var(--color-amber-500)' },
	{ key: 'KONTRA', label: 'Kontra', color: 'var(--color-purple-500)' },
	{ key: 'Keine90', label: 'K90', color: 'var(--color-sky-400)' },
	{ key: 'Keine60', label: 'K60', color: 'var(--color-sky-500)' },
	{ key: 'Keine30', label: 'K30', color: 'var(--color-sky-600)' },
	{ key: 'Schwarz', label: 'Schwarz', color: 'var(--color-gray-700)' }
];

export const bonusSeries = [
	{ key: 'doko', label: 'Doppelkopf', color: 'var(--color-lime-500)' },
	{ key: 'fuchs', label: 'Fuchs', color: 'var(--color-red-500)' },
	{ key: 'karlchen', label: 'Karlchen', color: 'var(--color-cyan-500)' }
];

// Small helper to increment map counters
export const increment = <K>(map: Map<K, number>, key: K, delta = 1) => {
	map.set(key, (map.get(key) || 0) + delta);
};
