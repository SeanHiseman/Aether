import { Algorithms, FeedAlgorithms } from './algorithms.js';
import { Feeds } from '../models/feeds.js';
import { Users } from '../models/users.js';

Users.hasMany(Algorithms, { foreignKey: 'user_id' });
Algorithms.belongsTo(Users, { foreignKey: 'user_id' });

Feeds.hasMany(FeedAlgorithms, { foreignKey: 'feed_id' });
FeedAlgorithms.belongsTo(Feeds, { foreignKey: 'feed_id' });

Algorithms.hasMany(FeedAlgorithms, { as: 'feed_algorithms', foreignKey: 'algorithm_id' });
FeedAlgorithms.belongsTo(Algorithms, { foreignKey: 'algorithm_id' });

Users.hasMany(FeedAlgorithms, { foreignKey: 'user_id' });
FeedAlgorithms.belongsTo(Users, { foreignKey: 'user_id' });

export {
	Users,
	Feeds,
	Algorithms,
	FeedAlgorithms
};