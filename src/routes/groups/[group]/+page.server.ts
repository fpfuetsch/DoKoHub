import { GroupRepository } from '$lib/repositories/group';

export const load = async ({ params }: { params: { group: string } }) => {
	const repo = new GroupRepository();
	const group = await repo.getById(params.group);
	if (!group) {
		return { group: null };
	}
	return { group: group.toJSON() };
};
