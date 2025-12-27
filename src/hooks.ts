import { Group } from '$lib/domain/group';
import type { Transport } from '@sveltejs/kit';

export const transport: Transport = {
    Group: {
        encode: (value) => value instanceof Group && value.toJSON(),
        decode: (value) => Group.fromJSON(value)
    }
};