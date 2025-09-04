import { STRING, DataTypes, TEXT } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Algorithms = sequelize.define('algorithms', {
    algorithm_id: { type: STRING(36), allowNull: false, primaryKey: true },   
    algorithm_name: { type: STRING(120), allowNull: false },
    algorithm_code: { type: TEXT, allowNull: false }, 
    custom_instruction: { type: TEXT, allowNull: true },  
    viewer_id: { type: STRING(36), allowNull: false },     
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)'), onUpdate: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, { tableName: 'algorithms', timestamps: false });

const AlgorithmLocations = sequelize.define('algorithm_locations', {
    id: { type: STRING(36), allowNull: false, primaryKey: true }, 
    algorithm_id: { type: STRING(36), allowNull: false },   
    location_id: { type: STRING(36), allowNull: false },
    viewer_id: { type: STRING(36), allowNull: false },
}, { tableName: 'algorithm_locations', timestamps: false });

export {
    Algorithms, 
    AlgorithmLocations
}