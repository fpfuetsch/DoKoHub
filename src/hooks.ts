import { Group } from '$lib/domain/group';
import { Player } from '$lib/domain/player';
import type { Transport } from '@sveltejs/kit';

export const transport: Transport = {
    Group: {
        encode: (value) => value instanceof Group && value.toJSON(),
        decode: (value) => Group.fromJSON(value)
    },
    Player: {
        encode: (value) => value instanceof Player && value.toJSON(),
        decode: (value) => Player.fromJSON(value)
    }
};