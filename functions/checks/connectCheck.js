import { Connections } from '../../models/messages.js';
import { Op } from 'sequelize';

async function ConnectCheck(feed1_id, feed2_id) {
    try {
        const following = await Connections.findOne({
            where: {
                [Op.or]: [
                    { feed1_id, feed2_id },
                    { feed1_id: feed2_id, feed2_id: feed1_id },
                ],
            },
        });
        return {
            connected: !!following,
        };
    } catch (error) {
        return { connected: false };
    }
}

export default ConnectCheck;