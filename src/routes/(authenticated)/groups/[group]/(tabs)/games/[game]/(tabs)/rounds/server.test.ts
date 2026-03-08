import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	requireUserOrFailMock,
	getByIdGameMock,
	gameRepositoryCtor,
	publishRoundsUpdatedMock,
	subscribeToRoundChangesMock
} = vi.hoisted(() => {
	const requireUserOrFailMock = vi.fn();
	const getByIdGameMock = vi.fn();
	const publishRoundsUpdatedMock = vi.fn();
	const subscribeToRoundChangesMock = vi.fn();

	const gameRepositoryCtor = vi.fn(function MockGameRepository(this: any) {
		this.getById = getByIdGameMock;
	});

	return {
		requireUserOrFailMock,
		getByIdGameMock,
		gameRepositoryCtor,
		publishRoundsUpdatedMock,
		subscribeToRoundChangesMock
	};
});

vi.mock('$lib/server/auth/guard', () => ({
	requireUserOrFail: requireUserOrFailMock
}));

vi.mock('$lib/server/repositories/game', () => ({
	GameRepository: gameRepositoryCtor
}));

vi.mock('$lib/server/realtime/round', () => ({
	subscribeToRoundChanges: subscribeToRoundChangesMock,
	publishRoundsUpdated: publishRoundsUpdatedMock
}));

import { GET } from './+server';

describe('rounds SSE endpoint (GET)', () => {
	let mockAbortSignal: { addEventListener: ReturnType<typeof vi.fn> };
	let mockRequest: {
		signal: typeof mockAbortSignal;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock abort signal for cleanup testing
		mockAbortSignal = {
			addEventListener: vi.fn()
		};

		mockRequest = {
			signal: mockAbortSignal
		};

		requireUserOrFailMock.mockReturnValue({ id: 'user-123' });
	});

	it('should reject unauthenticated requests', async () => {
		requireUserOrFailMock.mockImplementation(() => {
			throw new Error('Unauthorized');
		});

		try {
			await GET({
				locals: {},
				params: { game: 'game-1', group: 'group-1' },
				request: mockRequest
			} as any);
			expect.fail('Should have thrown');
		} catch (error) {
			expect((error as Error).message).toBe('Unauthorized');
		}
	});

	it('should return error response if user cannot access game', async () => {
		getByIdGameMock.mockResolvedValue({
			ok: false,
			status: 403,
			error: 'Forbidden'
		});

		const response = await GET({
			locals: { user: { id: 'user-123' } },
			params: { game: 'game-1', group: 'group-1' },
			request: mockRequest
		} as any);

		expect(response.status).toBe(403);
		await expect(response.text()).resolves.toBe('Forbidden');
	});

	it('should start SSE stream on successful auth', async () => {
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: { id: 'game-1' }
		});

		const unsubscribeMock = vi.fn();
		subscribeToRoundChangesMock.mockReturnValue(unsubscribeMock);

		const response = await GET({
			locals: { user: { id: 'user-123' } },
			params: { game: 'game-1', group: 'group-1' },
			request: mockRequest
		} as any);

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
		expect(response.headers.get('Connection')).toBe('keep-alive');
	});

	it('should subscribe to round changes for the correct game', async () => {
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: { id: 'game-1' }
		});

		subscribeToRoundChangesMock.mockReturnValue(vi.fn());

		await GET({
			locals: { user: { id: 'user-123' } },
			params: { game: 'game-123', group: 'group-456' },
			request: mockRequest
		} as any);

		expect(subscribeToRoundChangesMock).toHaveBeenCalledWith(
			'group-456',
			'game-123',
			expect.any(Function)
		);
	});

	it('should set up abort listener for cleanup', async () => {
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: { id: 'game-1' }
		});

		subscribeToRoundChangesMock.mockReturnValue(vi.fn());

		await GET({
			locals: { user: { id: 'user-123' } },
			params: { game: 'game-1', group: 'group-1' },
			request: mockRequest
		} as any);

		expect(mockAbortSignal.addEventListener).toHaveBeenCalledWith('abort', expect.any(Function));
	});

	it('should verify game access via repository', async () => {
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: { id: 'game-1' }
		});

		subscribeToRoundChangesMock.mockReturnValue(vi.fn());

		await GET({
			locals: { user: { id: 'user-123' } },
			params: { game: 'game-1', group: 'group-1' },
			request: mockRequest
		} as any);

		expect(gameRepositoryCtor).toHaveBeenCalledWith('user-123');
		expect(getByIdGameMock).toHaveBeenCalledWith('game-1', 'group-1');
	});

	it('should return stream with SSE headers', async () => {
		getByIdGameMock.mockResolvedValue({
			ok: true,
			value: { id: 'game-1' }
		});

		subscribeToRoundChangesMock.mockReturnValue(vi.fn());

		const response = await GET({
			locals: { user: { id: 'user-123' } },
			params: { game: 'game-1', group: 'group-1' },
			request: mockRequest
		} as any);

		expect(response.headers.get('Content-Type')).toBe('text/event-stream');
		expect(response.headers.get('X-Accel-Buffering')).toBe('no');
	});
});
