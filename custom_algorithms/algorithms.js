import { BOOLEAN, STRING, DataTypes, INTEGER, TEXT } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Algorithms = sequelize.define('algorithms', {
    algorithm_id: { type: STRING(36), primaryKey: true },   
    algorithm_name: { type: STRING(120), allowNull: false },
    algorithm_description: { type: TEXT, allowNull: true },
    algorithm_code: { type: TEXT, allowNull: false },  
    user_id: { type: STRING(36), allowNull: false },     
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'algorithms', timestamps: false });

const FeedAlgorithms = sequelize.define('algorithms', {
    algorithm_id: { type: STRING(36), allowNull: false },   
    feed_id: { type: STRING(36), allowNull: false },
    user_id: { type: STRING(36), allowNull: false },
}, { tableName: 'feed_algorithms', timestamps: false });

export {
    Algorithms, 
    FeedAlgorithms
}