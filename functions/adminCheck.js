import { Groups, UserGroups } from '../models/models.js';

async function checkIfUserIsAdmin(userId, groupName) {
    try {
        //Matches group name to group id
        const group = await Groups.findOne({
            where: { group_name: groupName}
        });
        const groupId = group.group_id;
        const userGroup = await UserGroups.findOne({
            where: {
                user_id: userId,
                group_id: groupId
            }
        });

        return userGroup ? userGroup.is_admin : false;
    } catch (error) {
        console.error('Error in admin check: ', error);
        return false;
    }
}

export default checkIfUserIsAdmin;