import { Connections } from '../../models/messages.js';
import { Op } from 'sequelize';

//Could add checking requests as well
async function ConnectCheck(feed1_id, feed2_id) {
    try {
        const connected = await Connections.findOne({
            where: {
                [Op.or]: [
                    { feed1_id, feed2_id },
                    { feed1_id: feed2_id, feed2_id: feed1_id },
                ],
            },
        });
        return {
            connected: !!connected,
        };
    } catch (error) {
        return { connected: false };
    }
}

export default ConnectCheck;