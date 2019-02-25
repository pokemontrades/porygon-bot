const _ = require('lodash');
const IRC = require('irc-framework');


exports.setUp = (config) => {
    var bot = new IRC.Client({
        host: config.server,
        port: config.port,
        nick: config.nick,
        username: config.userName,
        password: config.password,
        gecos: config.realName,
        auto_reconnect: true,
        tls: config.secure,
        rejectUnauthorized: !config.selfSigned
    });
    bot.on('message', (e) => console.log(e));
    bot.on('registered', function() {
        const channels = _.isArray(config.channels) ? config.channels : _.keys(config.channels);
        channels.forEach((channel) => {
            bot.join(channel);
        });
    });
    bot.connect();
    return bot;
};
