import { BOOLEAN, DATE, FLOAT, JSON, STRING, DataTypes, INTEGER, TEXT } from 'sequelize';
import cron from 'node-cron';
import sequelize from '../databaseSetup.js';

const ConnectedAccounts = sequelize.define('ConnectedAccounts', {
	id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
	user_id: { type: STRING(64), allowNull: false },
	platform: { type: STRING(32), allowNull: false }, //reddit, mastodon, bluesky, twitter, etc.
	handle: { type: STRING(190), allowNull: false }, //e.g. u/name, @user@instance
	access_token: { type: TEXT, allowNull: false },
	refresh_token: { type: TEXT, allowNull: true },
	token_type: { type: STRING(32), allowNull: true },
	scope: { type: TEXT, allowNull: true },
	expires_at: { type: DATE, allowNull: true },
	instance_url: { type: STRING(255), allowNull: true }, //for Mastodon/Fediverse
	extra: { type: JSON, allowNull: true },                //arbitrary per-platform data
    created_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
	tableName: 'connected_accounts',
	underscored: true,
    timestamps: false,
	indexes: [
		{ fields: ['user_id'] },
		{ unique: true, fields: ['user_id', 'platform', 'handle'] }
	]
});

const Users = sequelize.define('users', {
    user_id: { type: STRING(36), primaryKey: true },
    username: { type: STRING(120), allowNull: false },
    password: { type: STRING(120), allowNull: false },
    email: { type: STRING(120), allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    has_membership: { type: BOOLEAN, defaultValue: false }, 
    stripe_subscription_id: { type: STRING(255), allowNull: true }, 
    subscription_expires_at: { type: DataTypes.DATE(3), allowNull: true },
    theme: { type: STRING(1000), allowNull: true, defaultValue: '{"border":"#3e3f41","dark":"#232527","darkest":"#0f0f0f","light":"#737484",lightest:"#dddddd"}' },
    usage_count: { type: INTEGER, allowNull: false, defaultValue: 0 }, 
    storage_count: { type: FLOAT, allowNull: false, defaultValue: 0 }, 
    email_verified: { type: DataTypes.BOOLEAN, defaultValue: false},
    verification_token: { type: DataTypes.TEXT, allowNull: true},
    verification_token_expires: { type: DataTypes.DATE(3), allowNull: true },
    reset_token: { type: DataTypes.TEXT, allowNull: true },
    reset_token_expires:    { type: DataTypes.DATE(3), allowNull: true },
}, { tableName: 'users', timestamps: false });

cron.schedule('0 0 * * 0', async () => { //Resets usage count every Sunday night
    await Users.update({ usage_count: 0 }, { where: {} });
    await Users.update({ storage_count: 0 }, { where: {} });
});

export {
    ConnectedAccounts,
    Users,
}