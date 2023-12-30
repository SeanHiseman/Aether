import { UserGroups } from '../models/models.js';

async function checkIfUserIsAdmin(userId, groupId) {
    try {
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