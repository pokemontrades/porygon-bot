const Sequelize = require('sequelize');

module.exports = (sequelize) => sequelize.define('User', {
    UserID: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    Timezone: Sequelize.INTEGER,
    MainNick: Sequelize.STRING,
    RedditUsername: {
        type: Sequelize.STRING,
        defaultValue: null
    }
}, {
    tableName: 'User',
    timestamps: false
});