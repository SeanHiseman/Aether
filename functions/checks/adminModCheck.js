import { Groups, UserGroups } from '../../models/models.js';

async function checkIfUserIsAdminOrMod(userId, groupName) {
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

        return { isAdmin: userGroup.is_admin, isMod: userGroup.is_mod };
    } catch (error) {
        return { isAdmin: false, isMod: false };
    }
}

export default checkIfUserIsAdminOrMod;