export type RepoResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

export function ok(): RepoResult<void>;
export function ok<T>(value: T): RepoResult<T>;
export function ok<T>(value?: T): RepoResult<T> | RepoResult<void> {
	return { ok: true, value: value as T };
}

export const err = (error: string, status = 400): RepoResult<never> => ({
	ok: false,
	status,
	error
});

export type RepoVoidResult = RepoResult<void>;
