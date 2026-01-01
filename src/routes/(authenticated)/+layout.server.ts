import type { LayoutServerLoad } from './$types';
import { requireUserOrRedirectToLogin } from '$lib/server/auth/guard';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const user = requireUserOrRedirectToLogin({ locals, url });
	return { user };
};
