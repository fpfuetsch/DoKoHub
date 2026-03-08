import { requireUserOrFail } from '$lib/server/auth/guard';
import { GameRepository } from '$lib/server/repositories/game';
import { subscribeToRoundChanges, type RoundsUpdatedPayload } from '$lib/server/realtime/round';
import type { RequestHandler } from './$types';

const HEARTBEAT_INTERVAL_MS = 15000;

function formatSseMessage(event: string, payload: RoundsUpdatedPayload): string {
	return `id: ${payload.eventId}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const GET: RequestHandler = async ({ locals, params, request }) => {
	const user = requireUserOrFail({ locals });
	const gameResult = await new GameRepository(user.id).getById(params.game, params.group);
	if (!gameResult.ok) {
		return new Response(gameResult.error, { status: gameResult.status });
	}

	const encoder = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let unsubscribe: (() => void) | undefined;
	let cleanedUp = false;

	const cleanup = () => {
		if (cleanedUp) return;
		cleanedUp = true;

		if (heartbeat) {
			clearInterval(heartbeat);
			heartbeat = undefined;
		}
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = undefined;
		}
	};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode('retry: 3000\n\n'));

			unsubscribe = subscribeToRoundChanges(params.group, params.game, (payload) => {
				controller.enqueue(encoder.encode(formatSseMessage('rounds-updated', payload)));
			});

			heartbeat = setInterval(() => {
				controller.enqueue(encoder.encode(': heartbeat\n\n'));
			}, HEARTBEAT_INTERVAL_MS);

			request.signal.addEventListener('abort', () => {
				cleanup();
			});
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
