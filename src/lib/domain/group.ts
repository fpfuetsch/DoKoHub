import type { GroupType } from '$lib/server/db/schema';
import { Player } from './player';

export class Group implements GroupType {
	id: string;
	name: string;
	createdAt: Date;
	players: Player[];

	constructor(data: GroupType, players: Player[] = []) {
		this.id = data.id;
		this.name = data.name;
		this.createdAt = data.createdAt;
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
			{
				id: json.id,
				name: json.name,
				createdAt: new Date(json.createdAt)
			} as GroupType,
			json.players.map((p: any) => Player.fromJSON(p))
		);
	}
}
