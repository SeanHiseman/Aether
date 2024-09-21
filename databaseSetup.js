import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
dotenv.config();

//example username and password
const sequelize = new Sequelize('aether', process.env.DB_USER, process.env.DB_PASSWORD, {
    logging: false,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
});

export default sequelize;
