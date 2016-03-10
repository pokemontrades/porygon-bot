'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
var irc = require('irc');
var mysql = require('promise-mysql');
var config = require('./config');
var db = require('./services/db');
var commands = require('./commands');
const warn = _.memoize(console.warn);

if (!config.disable_db) {
    mysql.createConnection({
        host: config.dbHost,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.database,
        timezone: 'Etc/UTC'
    }).then(function(conn) {

        db.conn = conn;
        
        Object.keys(db.modules).forEach(function(event) {
            Object.keys(db.modules[event]).forEach(function(name) {
                if (commands[event] === undefined) {
                    commands[event] = {};
                }
                commands[event][name] = db.modules[event][name];
            });
        });

    }).catch(function(error) {
        console.log("An error occurred while establishing a connection to the database. Details can be found below:\n"+error+"\nThe following modules, which require database connectivity, have been disabled: ["+db.listModules().join(", ")+"]");
    });
} else {
    console.log("The following modules, which require database connectivity, have been disabled: ["+db.listModules().join(", ")+"]");
}

var bot = new irc.Client(config.server, config.nick, {
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

bot.on('messageError', function(e) {
    console.log(e);
});

function outputResponse(target, messages) {
    if (!messages) {
        return;
    }
    if (typeof messages === 'string') {
        bot.say(target, messages);
    } else if (Array.isArray(messages)) {
        for (let i = 0; i < messages.length; i++) {
            outputResponse(target, messages[i]);
        }
    } else if (typeof messages === 'object' && messages.then) {
        messages.then(function (results) {
            outputResponse(target, results);
        }, function (error) {
            handleError(target, error);
        });
    } else if (typeof messages === 'object' && ('response_type' in messages)) {
        if ('target' in messages) {
            target = messages['target'];
        }
        switch (messages['response_type']) {
            case 'text':
                bot.say(target, messages['message']);
                break;
            case 'action':
                bot.action(target, messages['message']);
                break;
            default:
                console.log("Message containing invalid `response_type` passed to outputResponse()");
        }
    } else {
        throw 'Invalid `messages` argument passed to outputResponse()';
    }
}

function defaultAllow ({isPM, isMod, isAuthenticated}) { // The default allow() function that gets used for a command if allow() is not provided
    return !isPM || isMod && isAuthenticated;
}

// Main listener for channel messages/PMs
function executeCommands (event, author, channel, text) {
    let isPM = channel === bot.nick;
    let target = isPM ? author : channel;
    for (let i in commands[event]) {
        let message_match = commands[event][i].message_regex && commands[event][i].message_regex.exec(text);
        let author_match = (commands[event][i].author_regex || /.*/).exec(author);
        if (message_match && author_match && author !== bot.nick && (isPM || checkCommandEnabled(channel, i, config.channels[channel]))) {
            Promise.join(checkIfUserIsMod(author), checkAuthenticated(author), (isMod, isAuthenticated) => {
                if ((commands[event][i].allow || defaultAllow)({isPM, isMod, isAuthenticated})) {
                    outputResponse(target, commands[event][i].response({bot, message_match, author_match, channel, isMod, isAuthenticated}));
                }
            }).catch(_.partial(handleError, target));
        }
    }
}

function handleError (target, error) {
    if (error.error_message) {
        outputResponse(target, error.error_message);
    }
    if (_.isError(error)) {
        console.error(error);
    }
}

function checkIfUserIsMod (username) { // Returns a Promise that will resolve as true if the user is in the mod database, and false otherwise
    if (config.disable_db || db.conn == null) {
        return Promise.resolve(true);
    }
    return db.conn.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?', ['%' + username + '%']).then(res => !!res.length);
}

function checkAuthenticated (username) { // Returns a Promise that will resolve as true if the user is identified, and false otherwise
    bot.say('NickServ', `STATUS ${username}`);
    var awaitResponse = () => new Promise(resolve => {
        bot.once('notice', (nick, to, text) => {
            if (nick === 'NickServ' && to === bot.nick && text.indexOf(`STATUS ${username} `) === 0) {
                resolve(text.slice(-1) === '3');
            } else { // The notice was something unrelated, set up the listener again
                resolve(awaitResponse());
            }
        });
    });
    return awaitResponse().timeout(5000, 'Timed out waiting for NickServ response');
}

function checkCommandEnabled (channelName, commandName, channelConfig) {
    if (_.isArray(config.channels)) {
        warn('Warning: No channel-specific configurations detected in the config file. All commands will be allowed on all channels.');
    }
    if (channelConfig === undefined) {
        warn(`Warning: No channel-specific configuration found for the channel ${channelName}. All commands on this channel will be ignored.`);
        return false;
    }
    if (_.isBoolean(channelConfig)) {
        return channelConfig;
    }
    if (_.isRegExp(channelConfig)) {
        return channelConfig.test(commandName);
    }
    if (_.isArray(channelConfig)) {
        return _.includes(channelConfig, commandName);
    }
    if (_.isString(channelConfig)) {
        return channelConfig === commandName;
    }
    if (_.isFunction(channelConfig)) {
        return !!channelConfig(commandName);
    }
    warn(`Warning: Failed to parse channel-specific configuration for the channel ${channelName}. All commands on this channel will be ignored.`);
    return false;
}


bot.addListener('error', function (message) {
    console.error('Error: ', message);
});

bot.addListener('message', executeMsgCommands);
bot.addListener('join', executeJoinCommands);
bot.addListener('action', executeActionCommands);

function executeMsgCommands(author, chan, text) {
    executeCommands('message', author, chan, text);
}

function executeJoinCommands(chan, user) {
    executeCommands('join', user, chan);
}

function executeActionCommands(author, chan, text) {
    executeCommands('action', author, chan, text);
}
