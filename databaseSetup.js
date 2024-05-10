import { Sequelize } from 'sequelize';
//example username and password
const sequelize = new Sequelize('username', 'root', 'password', {//change with your details
    logging: false,
    host: 'localhost',
    port: 3306,
    dialect: 'mysql',
});

export default sequelize;
