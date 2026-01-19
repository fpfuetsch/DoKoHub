import { Game } from '$lib/domain/game';
import { Group } from '$lib/domain/group';
import { Player } from '$lib/domain/player';
import { Round } from '$lib/domain/round';
import type { Transport } from '@sveltejs/kit';

export const transport: Transport = {
	Group: {
		encode: (value) => value instanceof Group && value.toJSON(),
		decode: (value) => Group.fromJSON(value)
	},
	Player: {
		encode: (value) => value instanceof Player && value.toJSON(),
		decode: (value) => Player.fromJSON(value)
	},
	Game: {
		encode: (value) => value instanceof Game && value.toJSON(),
		decode: (value) => Game.fromJSON(value)
	},
	Round: {
		encode: (value) => value instanceof Round && value.toJSON(),
		decode: (value) => Round.fromJSON(value)
	}
};
