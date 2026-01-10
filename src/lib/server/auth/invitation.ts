import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { env } from '$env/dynamic/private';

const DEFAULT_INVITATION_JWT_SECRET = 'dev-invitation-secret-change-me';
const rawInvitationSecret = env.INVITATION_JWT_SECRET ?? DEFAULT_INVITATION_JWT_SECRET;
if (rawInvitationSecret === DEFAULT_INVITATION_JWT_SECRET) {
	// eslint-disable-next-line no-console
	console.warn(
		'WARNING: Using default Invitation JWT secret. Set INVITATION_JWT_SECRET in env for production.'
	);
}
const secret = new TextEncoder().encode(rawInvitationSecret);
export const INVITATION_MAX_AGE_SECONDS = env.INVITATION_MAX_AGE_SECONDS
	? parseInt(env.INVITATION_MAX_AGE_SECONDS)
	: 24 * 60 * 60; // default: 24 hours

export async function signInvite(payload: { groupId: string; groupName: string }) {
	const alg = 'HS256';
	const key = secret;
	const jwt = await new SignJWT(payload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(Math.floor(Date.now() / 1000) + INVITATION_MAX_AGE_SECONDS)
		.sign(key);

	return jwt;
}

export async function verifyInvite(token: string): Promise<JWTPayload | null> {
	const key = secret;
	try {
		const { payload } = await jwtVerify(token, key);
		return payload as JWTPayload;
	} catch (e) {
		return null;
	}
}
