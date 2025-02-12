import { BOOLEAN, FLOAT, STRING, DataTypes, INTEGER } from 'sequelize';
import sequelize from '../databaseSetup.js';

const Users = sequelize.define('users', {
    user_id: { type: STRING(36), primaryKey: true },
    username: { type: STRING(120), allowNull: false },
    password: { type: STRING(120), allowNull: false },
    email: { type: STRING(120), allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    collaborative_preference: { type: FLOAT, allowNull: false, defaultValue: 0.5 },
    time_preference: { type: FLOAT, allowNull: false, defaultValue: 0.0001 },
    has_membership: { type: BOOLEAN, defaultValue: false }, 
    theme: { type: STRING(120), allowNull: true, defaultValue: 'dark' },
    points: { type: INTEGER, allowNull: false, defaultValue: 0 }, 
}, { tableName: 'users', timestamps: false });

export {
    Users,
}