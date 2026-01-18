import { BOOLEAN, DATE, FLOAT, JSON, STRING, DataTypes, INTEGER, TEXT } from 'sequelize';
import cron from 'node-cron';
import sequelize from '../databaseSetup.js';

const ConnectedAccounts = sequelize.define('ConnectedAccounts', {
	id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
	user_id: { type: STRING(64), allowNull: false },
	platform: { type: STRING(32), allowNull: false }, //reddit, mastodon, bluesky, twitter, etc.
	handle: { type: STRING(190), allowNull: true }, //e.g. u/name, @user@instance
	access_token: { type: TEXT, allowNull: true },
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
		{ unique: true, fields: ['user_id', 'platform'] }
	]
});

const Feedback = sequelize.define('Feedback', {
	id: { type: STRING(36), primaryKey: true, defaultValue: DataTypes.UUIDV4, },
	user_id: { type: STRING(36), allowNull: true },
	message: { type: DataTypes.TEXT, allowNull: false },
	is_resolved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_deletion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
	tableName: 'feedback',
    timestamps: false,
	indexes: [
		{ name: 'idx_feedback_user_id', fields: ['user_id'] },
		{ name: 'idx_feedback_created_at', fields: ['created_at'] },
		{ name: 'idx_feedback_is_resolved', fields: ['is_resolved'] },
        { name: 'idx_feedback_is_deletion', fields: ['is_deletion'] },
	],
}); 

const Users = sequelize.define('users', {
    user_id: { type: STRING(36), primaryKey: true },
    username: { type: STRING(120), allowNull: false },
    password: { type: STRING(120), allowNull: false },
    email: { type: STRING(120), allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DataTypes.DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    last_active_at: { type: DataTypes.DATE(3), allowNull: true, defaultValue: null },
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
    reset_token_expires: { type: DataTypes.DATE(3), allowNull: true },
    google_id: { type: STRING(255), unique: true, allowNull: true },
    bluesky_did: { type: STRING(255), unique: true, allowNull: true }
}, { tableName: 'users', timestamps: false });

const ExternalFollows = sequelize.define('ExternalFollows', {
    id: { type: STRING(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id: { type: STRING(36), allowNull: false },
    did: { type: STRING(255), allowNull: false },
    handle: { type: STRING(255), allowNull: false },
    display_name: { type: STRING(255), allowNull: true },
    avatar: { type: TEXT, allowNull: true },
    description: { type: TEXT, allowNull: true },
    platform: { type: STRING(255), allowNull: false },
    created_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
    updated_at: { type: DATE(3), defaultValue: sequelize.literal('CURRENT_TIMESTAMP(3)') },
}, {
    tableName: 'external_follows',
    underscored: true,
    timestamps: false,
    indexes: [
        { fields: ['user_id'] },
        { unique: true, fields: ['user_id', 'did'] }
    ]
});

cron.schedule('0 0 * * 0', async () => { //Resets usage count every Sunday night
    await Users.update({ usage_count: 0 }, { where: {} });
    await Users.update({ storage_count: 0 }, { where: {} });
});

export {
    ExternalFollows,
    ConnectedAccounts,
    Feedback,
    Users,
}