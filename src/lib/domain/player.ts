import type { PlayerType, AuthProviderType } from '$lib/server/db/schema';

export class Player implements PlayerType {
	id: string;
	name: string;
	authProvider: AuthProviderType;
	authProviderId: string | null;
	createdAt: Date;

	constructor(data: PlayerType) {
		this.id = data.id;
		this.name = data.name;
		this.authProvider = data.authProvider;
		this.authProviderId = data.authProviderId;
		this.createdAt = data.createdAt;
	}

	get displayName() {
		return this.name;
	}

	toJSON() {
		return { ...this };
	}

	static fromJSON(json: any): Player {
		return new Player({
			id: json.id,
			name: json.name,
			authProvider: json.authProvider,
			authProviderId: json.authProviderId,
			createdAt: new Date(json.createdAt)
		});
	}
}
