import { GroupRepository } from '$lib/repositories/group';

export const load = async ({ params }: { params: { group: string } }) => {
	const repo = new GroupRepository();
	return { group: await repo.getById(params.group) };
};
