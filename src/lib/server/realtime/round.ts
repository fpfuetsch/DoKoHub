type RoundsUpdatedPayload = {
	eventId: string;
	timestamp: number;
};

type RoundListener = (payload: RoundsUpdatedPayload) => void;

type RoundEventsStore = {
	listenersByGame: Map<string, Set<RoundListener>>;
};

const GLOBAL_ROUND_EVENTS_KEY = '__dokohub_round_events__';

function getStore(): RoundEventsStore {
	const scope = globalThis as typeof globalThis & {
		[GLOBAL_ROUND_EVENTS_KEY]?: RoundEventsStore;
	};

	if (!scope[GLOBAL_ROUND_EVENTS_KEY]) {
		scope[GLOBAL_ROUND_EVENTS_KEY] = {
			listenersByGame: new Map()
		};
	}

	return scope[GLOBAL_ROUND_EVENTS_KEY]!;
}

function gameKey(groupId: string, gameId: string): string {
	return `${groupId}:${gameId}`;
}

export function publishRoundsUpdated(groupId: string, gameId: string): RoundsUpdatedPayload {
	const payload: RoundsUpdatedPayload = {
		eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
		timestamp: Date.now()
	};

	const listeners = getStore().listenersByGame.get(gameKey(groupId, gameId));
	if (!listeners || listeners.size === 0) {
		return payload;
	}

	for (const listener of listeners) {
		try {
			listener(payload);
		} catch (error) {
			console.error('Failed to deliver round change event', error);
		}
	}

	return payload;
}

export function subscribeToRoundChanges(
	groupId: string,
	gameId: string,
	listener: RoundListener
): () => void {
	const store = getStore();
	const key = gameKey(groupId, gameId);
	const listeners = store.listenersByGame.get(key) ?? new Set<RoundListener>();
	listeners.add(listener);
	store.listenersByGame.set(key, listeners);

	return () => {
		const current = store.listenersByGame.get(key);
		if (!current) return;
		current.delete(listener);
		if (current.size === 0) {
			store.listenersByGame.delete(key);
		}
	};
}

export type { RoundsUpdatedPayload };
