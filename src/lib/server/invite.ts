import { jwtVerify, SignJWT, type JWTPayload } from 'jose';

const INVITE_EXPIRATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretBytes(): Uint8Array {
	const secret = process.env.INVITE_JWT_SECRET;
	if (!secret) throw new Error('INVITE_JWT_SECRET not set');
	return new TextEncoder().encode(secret);
}

export async function signInvite(payload: { groupId: string; purpose?: string }) {
	const alg = 'HS256';
	const key = getSecretBytes();

	const jwt = await new SignJWT(payload)
		.setProtectedHeader({ alg })
		.setIssuedAt()
		.setExpirationTime(Math.floor(Date.now() / 1000) + INVITE_EXPIRATION_SECONDS)
		.sign(key);

	return jwt;
}

export async function verifyInvite(token: string): Promise<JWTPayload | null> {
	const key = getSecretBytes();
	try {
		const { payload } = await jwtVerify(token, key);
		return payload as JWTPayload;
	} catch (e) {
		return null;
	}
}
