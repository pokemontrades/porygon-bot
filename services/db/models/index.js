module.exports = (sequelize) => {
    const User = require('./User')(sequelize);
    const Alias = require('./Alias')(sequelize);
    const Message = require('./Message')(sequelize);

    User.hasMany(Alias, {foreignKey: 'UserID'});
    Alias.belongsTo(User, {foreignKey: 'UserID'});

    User.hasMany(Message, {foreignKey: 'TargetID'});
    Message.belongsTo(User, {foreignKey: 'TargetID'});

    return {
        User,
        Alias,
        Message
    };
};