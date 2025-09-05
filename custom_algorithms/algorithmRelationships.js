import { Algorithms, AlgorithmLocations } from './algorithms.js';
import { Feeds, FeedChannels } from '../models/relationships.js';

Feeds.hasMany(Algorithms, { foreignKey: 'viewer_id' });
Algorithms.belongsTo(Feeds, { foreignKey: 'viewer_id' });

Algorithms.hasMany(AlgorithmLocations, { as: 'algorithm_locations', foreignKey: 'algorithm_id' });
AlgorithmLocations.belongsTo(Algorithms, { foreignKey: 'algorithm_id' });

FeedChannels.hasMany(AlgorithmLocations, { foreignKey: 'location_id', sourceKey: 'channel_id' });
AlgorithmLocations.belongsTo(FeedChannels, { foreignKey: 'location_id', targetKey: 'channel_id' });

Feeds.hasMany(AlgorithmLocations, { foreignKey: 'viewer_id' });
AlgorithmLocations.belongsTo(Feeds, { foreignKey: 'viewer_id' });

export {
	Algorithms,
	AlgorithmLocations
};