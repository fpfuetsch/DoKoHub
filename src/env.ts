import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { schema: (input) => input },
	GOOGLE_CLIENT_ID: { schema: (input) => input },
	GOOGLE_CLIENT_SECRET: { schema: (input) => input },
	INVITATION_JWT_SECRET: { schema: (input) => input },
	INVITATION_MAX_AGE_SECONDS: { schema: (input) => input },
	AUTH_JWT_SECRET: { schema: (input) => input },
	ONBOARDING_MAX_AGE_SECONDS: { schema: (input) => input },
	SESSION_MAX_AGE_SECONDS: { schema: (input) => input }
});
