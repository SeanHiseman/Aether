import { Sequelize } from 'sequelize';
//example username and password
const sequelize = new Sequelize('aether', 'root', 'LETMEINpls26', {
    logging: false,
    host: 'localhost',
    port: 3306,
    dialect: 'mysql',
});

export default sequelize;
