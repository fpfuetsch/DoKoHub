import type { Player as PlayerType } from '$lib/types/db';

export class Player implements PlayerType {
	id: string;
	name: string;
	email: string;
	createdAt: Date;

	constructor(data: PlayerType) {
		this.id = data.id;
		this.name = data.name;
		this.email = data.email;
		this.createdAt = data.createdAt;
	}

	get displayName() {
		return `${this.name} <${this.email}>`;
	}

	toJSON() {
		return { ...this };
	}

	static fromJSON(json: any): Player {
		return new Player({
			id: json.id,
			name: json.name,
			email: json.email,
			createdAt: new Date(json.createdAt)
		});
	}
}
