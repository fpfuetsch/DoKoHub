import { redirect } from '@sveltejs/kit';

export const load = async ({ params }: { params: { group: string; game: string } }) => {
	throw redirect(302, `/groups/${params.group}/games/${params.game}/rounds`);
};
