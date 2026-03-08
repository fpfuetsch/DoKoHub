import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishRoundsUpdated, subscribeToRoundChanges } from './round';

describe('round events', () => {
	// Clear globalThis between tests to isolate store state
	beforeEach(() => {
		delete (globalThis as any).__dokohub_round_events__;
	});

	describe('subscribeToRoundChanges', () => {
		it('should register a listener for a game', () => {
			const listener = vi.fn();
			subscribeToRoundChanges('group-1', 'game-1', listener);

			const payload = publishRoundsUpdated('group-1', 'game-1');
			expect(listener).toHaveBeenCalledWith(payload);
		});

		it('should return an unsubscribe function', () => {
			const listener = vi.fn();
			const unsubscribe = subscribeToRoundChanges('group-1', 'game-1', listener);

			publishRoundsUpdated('group-1', 'game-1');
			expect(listener).toHaveBeenCalledTimes(1);

			unsubscribe();

			publishRoundsUpdated('group-1', 'game-1');
			expect(listener).toHaveBeenCalledTimes(1); // Not called again
		});

		it('should scope listeners by game', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			subscribeToRoundChanges('group-1', 'game-1', listener1);
			subscribeToRoundChanges('group-1', 'game-2', listener2);

			publishRoundsUpdated('group-1', 'game-1');

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).not.toHaveBeenCalled();
		});

		it('should support multiple listeners on same game', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();

			subscribeToRoundChanges('group-1', 'game-1', listener1);
			subscribeToRoundChanges('group-1', 'game-1', listener2);

			publishRoundsUpdated('group-1', 'game-1');

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
		});
	});

	describe('publishRoundsUpdated', () => {
		it('should return payload with eventId and timestamp', () => {
			const payload = publishRoundsUpdated('group-1', 'game-1');

			expect(payload).toHaveProperty('eventId');
			expect(payload).toHaveProperty('timestamp');
			expect(typeof payload.eventId).toBe('string');
			expect(typeof payload.timestamp).toBe('number');
		});

		it('should generate unique eventIds', () => {
			const payload1 = publishRoundsUpdated('group-1', 'game-1');
			const payload2 = publishRoundsUpdated('group-1', 'game-1');

			expect(payload1.eventId).not.toBe(payload2.eventId);
		});

		it('should deliver to all listeners of target game', () => {
			const listener1 = vi.fn();
			const listener2 = vi.fn();
			const listener3 = vi.fn();

			subscribeToRoundChanges('group-1', 'game-1', listener1);
			subscribeToRoundChanges('group-1', 'game-2', listener2);
			subscribeToRoundChanges('group-1', 'game-1', listener3);

			publishRoundsUpdated('group-1', 'game-1');

			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).not.toHaveBeenCalled();
			expect(listener3).toHaveBeenCalledTimes(1);
		});

		it('should handle listener errors gracefully', () => {
			const badListener = vi.fn().mockImplementation(() => {
				throw new Error('Listener failed');
			});
			const goodListener = vi.fn();

			subscribeToRoundChanges('group-1', 'game-1', badListener);
			subscribeToRoundChanges('group-1', 'game-1', goodListener);

			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			//  Should not throw, despite bad listener
			expect(() => {
				publishRoundsUpdated('group-1', 'game-1');
			}).not.toThrow();

			expect(goodListener).toHaveBeenCalledTimes(1);
			expect(consoleErrorSpy).toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
		});

		it('should not call listeners if no subscribers', () => {
			const listener = vi.fn();
			subscribeToRoundChanges('group-1', 'game-1', listener);
			listener.mockClear();

			// Publish to different game with no subscribers
			publishRoundsUpdated('group-1', 'game-2');

			expect(listener).not.toHaveBeenCalled();
		});

		it('should clean up empty listener sets', () => {
			const listener = vi.fn();
			const unsubscribe = subscribeToRoundChanges('group-1', 'game-1', listener);

			unsubscribe();

			// Publish to same game - should not call anything, and set should be removed
			publishRoundsUpdated('group-1', 'game-1');

			expect(listener).not.toHaveBeenCalled();
		});
	});
});
