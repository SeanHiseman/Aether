import { Groups, UserGroups } from '../models/models.js';

async function checkIfUserIsMember(userId, groupName) {
    const group = await Groups.findOne({ where: { group_name: groupName }});
    if (!group) {
        console.error('Error in member check: ', error);
        return false;
    }

    const membership = await UserGroups.findOne({
        where: {
            user_id: userId,
            group_id: group.group_id
        },
    });
    return !!membership;
}

export default checkIfUserIsMember;