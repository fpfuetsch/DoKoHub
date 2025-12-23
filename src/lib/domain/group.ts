import type { Group as GroupType } from '$lib/types/db';
import type { Player as PlayerType } from '$lib/types/db';
import { pl } from 'zod/locales';
import { Player } from './player';

export class Group implements GroupType {
	id: string;
	name: string | null;
	createdAt: Date;
	players: Player[];

	constructor(id: string, name: string | null, createdAt: Date, players: Player[] = []) {
		this.id = id;
		this.name = name;
		this.createdAt = createdAt;
		this.players = players;
	}

	addPlayer(player: Player) {
		this.players.push(player);
	}

	toJSON() {
		return {
			id: this.id,
			name: this.name,
			createdAt: this.createdAt,
			players: this.players.map((p) => p.toJSON())
		};
	}

	static fromJSON(json: any): Group {
		return new Group(
			json.id,
			json.name,
			new Date(json.createdAt),
			json.players.map((p: any) => Player.fromJSON(p))
		);
	}
}
