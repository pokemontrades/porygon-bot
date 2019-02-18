const Sequelize = require('sequelize');

module.exports = (sequelize) => sequelize.define('Message', {
    MessageID: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    TargetID: Sequelize.INTEGER,
    SenderName: Sequelize.STRING,
    MessageText: Sequelize.STRING,
    MessageDate: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },
    Location: Sequelize.STRING,
    UserNotified: Sequelize.BOOLEAN
}, {
    tableName: 'Message',
    timestamps: false
});