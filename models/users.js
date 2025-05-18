import { BOOLEAN, FLOAT, STRING, DataTypes, INTEGER } from 'sequelize';
import cron from 'node-cron';
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
    theme: { type: STRING(1000), allowNull: true, defaultValue: '{"border":"#323437","dark":"#232527","darkest":"#0f0f0f","light":"#737484",lightest:"#dddddd"}' },
    points: { type: INTEGER, allowNull: false, defaultValue: 0 }, 
    usage_count: { type: INTEGER, allowNull: false, defaultValue: 0 }, 
    storage_count: { type: FLOAT, allowNull: false, defaultValue: 0 }, 
}, { tableName: 'users', timestamps: false });

cron.schedule('0 0 * * 0', async () => { //Resets usage count every Sunday night
    await Users.update({ usage_count: 0 }, { where: {} });
    await Users.update({ storage_count: 0 }, { where: {} });
});

export {
    Users,
}