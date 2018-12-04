const Sequelize = require('sequelize');

module.exports = (sequelize) => sequelize.define('Alias', {
    AliasID: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    UserID: Sequelize.INTEGER,
    Alias: Sequelize.STRING,
    isNick: Sequelize.BOOLEAN
}, {
    tableName: 'Alias',
    timestamps: false
});