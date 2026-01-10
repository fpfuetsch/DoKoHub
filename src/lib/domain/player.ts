import type { PlayerType } from '$lib/server/db/schema';
import type { AuthProviderType } from '$lib/domain/enums';

export class Player implements PlayerType {
	id: string;
	displayName: string;
	authProvider: AuthProviderType;
	authProviderId: string | null;
	createdAt: Date;

	constructor(data: PlayerType) {
		this.id = data.id;
		this.displayName = data.displayName;
		this.authProvider = data.authProvider;
		this.authProviderId = data.authProviderId;
		this.createdAt = data.createdAt;
	}

	getTruncatedDisplayName(maxLength: number = 8): string {
		if (this.displayName.length <= maxLength + 3) {
			return this.displayName;
		}
		return this.displayName.slice(0, maxLength) + '...';
	}

	toJSON() {
		return { ...this };
	}

	static fromJSON(json: any): Player {
		return new Player({
			id: json.id,
			displayName: json.displayName,
			authProvider: json.authProvider,
			authProviderId: json.authProviderId,
			createdAt: new Date(json.createdAt)
		});
	}
}
