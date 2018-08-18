const _ = require('lodash');
const irc = require('irc');

exports.setUp = (config) => {
    return new irc.Client(config.server, config.nick, {
        userName: config.userName,
        realName: config.realName,
        channels: _.isArray(config.channels) ? config.channels : _.keys(config.channels),
        port: config.port,
        secure: config.secure,
        selfSigned: config.selfSigned,
        certExpired: config.certExpired,
        encoding: 'UTF-8',
        password: config.password
    });
};