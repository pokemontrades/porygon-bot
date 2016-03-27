'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
var irc = require('irc');
var mysql = require('promise-mysql');
var config = require('./config');
var db = require('./services/db');
var commands = require('./commands');
const tasks = require('./tasks');
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
    } else if (_.isObject(messages) && typeof messages.then === 'function') {
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
        let message_match = (commands[event][i].message_regex || /.*/).exec(text);
        let author_match = (commands[event][i].author_regex || /.*/).exec(author);
        if (message_match && author_match && author !== bot.nick && (isPM || checkEnabled(channel, i, config.channels[channel]))) {
            Promise.join(checkIfUserIsMod(author), checkAuthenticated(author), (isMod, isAuthenticated) => {
                if ((commands[event][i].allow || defaultAllow)({isPM, isMod, isAuthenticated})) {
                    outputResponse(target, commands[event][i].response({bot, message_match, author_match, channel, isMod, isAuthenticated, eventType: event}));
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

function checkEnabled (channelName, itemName, itemConfig) {
    if (itemConfig === undefined) {
        warn(`Warning: No channel-specific configuration found for the channel ${channelName}. All commands on this channel will be ignored.`);
        return false;
    }
    if (_.isBoolean(itemConfig)) {
        return itemConfig;
    }
    if (_.isRegExp(itemConfig)) {
        return itemConfig.test(itemName);
    }
    if (_.isArray(itemConfig)) {
        return _.includes(itemConfig, itemName);
    }
    if (_.isString(itemConfig)) {
        return itemConfig === itemName;
    }
    if (_.isFunction(itemConfig)) {
        return !!itemConfig(itemName);
    }
    warn(`Warning: Failed to parse channel-specific configuration for the channel ${channelName}. All commands on this channel will be ignored.`);
    return false;
}

bot.on('error', console.error);
bot.on('message', _.partial(executeCommands, 'message'));
bot.on('join', (chan, user) => executeCommands('join', user, chan));
bot.on('action', _.partial(executeCommands, 'action'));
bot.on('+mode', (chan, by, mode, argument) => executeCommands(`mode +${mode}`, by, chan, argument));
bot.on('-mode', (chan, by, mode, argument) => executeCommands(`mode -${mode}`, by, chan, argument));

function executeTask(taskName) {
  const params = tasks[taskName];
  const iteratee = params.concurrent ? params.task : _.once(params.task);
  _.forOwn(config.tasks, (channelConfig, channel) => {
    if (checkEnabled(channel, taskName, channelConfig)) {
      outputResponse(channel, iteratee({bot, channel}));
    }
  });
}

bot.once('join', () => {
  _.forOwn(tasks, (params, taskName) => {
    if (params.onStart) {
      executeTask(taskName);
    }
    setInterval(executeTask, params.period * 1000, taskName);
  });
});
