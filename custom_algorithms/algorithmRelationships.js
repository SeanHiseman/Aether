import { Algorithms, AlgorithmLocations } from './algorithms.js';
import { DeepFeeds, Feeds, FeedChannels, Users } from '../models/relationships.js';

Users.hasMany(Algorithms, { foreignKey: 'user_id' });
Algorithms.belongsTo(Users, { foreignKey: 'user_id' });

FeedChannels.hasMany(AlgorithmLocations, { foreignKey: 'location_id', sourceKey: 'channel_id' });
AlgorithmLocations.belongsTo(FeedChannels, { foreignKey: 'location_id', targetKey: 'channel_id' });

//DeepFeeds.hasMany(AlgorithmLocations, { foreignKey: 'deep_feed_id' });
//AlgorithmLocations.belongsTo(DeepFeeds, { foreignKey: 'deep_feed_id' });

Algorithms.hasMany(AlgorithmLocations, { as: 'algorithm_locations', foreignKey: 'algorithm_id' });
AlgorithmLocations.belongsTo(Algorithms, { foreignKey: 'algorithm_id' });

Users.hasMany(AlgorithmLocations, { foreignKey: 'user_id' });
AlgorithmLocations.belongsTo(Users, { foreignKey: 'user_id' });

export {
	Users,
	Feeds,
	Algorithms,
	AlgorithmLocations
};