import {Users, Profiles} from './models.js'

//access specific data for logged in user
export default async function (req, columns = ['profile_id', 'profile_photo', 'bio']) {
    // Prevent SQL injection by validating column names
    const validColumns = new Set(['profile_id', 'user_id', 'profile_photo', 'bio']);
    if (!columns.every(col => validColumns.has(col))) {
        throw new Error("Invalid column names");
    }

    const userId = req.session.user_id; 
    if (!userId) {
        return null;
    }

    const user = await Users.findOne({
        where: { user_id: userId },
        include: [{
            model: Profiles,
            attributes: columns
        }]
    });

    if (!user || !user.Profile) {
        return columns.map(() => null);
    }

    return columns.map(col => user.Profile[col]);
};