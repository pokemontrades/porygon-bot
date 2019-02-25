'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
var config = require('./config');
var db = require('./services/db');
var commands = require('./commands');
const tasks = require('./tasks');
const warn = _.memoize(console.warn);
const bot = require('./services/irc').setUp(config.irc);
const Op = require('sequelize').Op;

if (!config.db) {
    // Old config. Maybe we should give the user an option to rewrite the config
    console.error("Config format has changed, please reformat");
    process.exit(1);
}

if (config.db.enabled) {
    db.setUp(config.db, commands);
} else {
    console.log("The following modules, which require database connectivity, have been disabled: ["+db.listModules().join(", ")+"]");
}

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
function executeCommands (event, {nick: author, target: channel, message: text}) {
    let isPM = channel === bot.user.nick;
    let target = isPM ? author : channel;
    for (let i in commands[event]) {
        let message_match = (commands[event][i].message_regex || /.*/).exec(text);
        let author_match = (commands[event][i].author_regex || /.*/).exec(author);
        if (message_match && author_match && author !== bot.user.nick && (isPM || checkEnabled(channel, i, config.irc.channels[channel]))) {
            Promise.join(checkIfUserIsMod(author), checkAuthenticated(author), (isMod, isAuthenticated) => {
                if ((commands[event][i].allow || defaultAllow)({isPM, isMod, isAuthenticated})) {
                    outputResponse(target, commands[event][i].response({bot, message_match, author_match, channel, isMod, isAuthenticated, eventType: event, isPM}));
                } else if (config.debug) {
                    outputResponse(target, "You are not authorised to run that command");
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
    if (!config.db.enabled || db.connected) {
        return Promise.resolve(true);
    }
    return db.models.Alias
        .find({where: {isNick: {[Op.eq]: true}, Alias: {[Op.eq]: username}}, include: [db.models.User]})
        .then((user) => user !== undefined);
}

function checkAuthenticated (username) { // Returns a Promise that will resolve as true if the user is identified, and false otherwise
    bot.say('NickServ', `STATUS ${username}`);
    var awaitResponse = () => new Promise(resolve => {
        bot.on('notice', ({nick, to, message}) => {
            if (nick === 'NickServ' && to === bot.nick && message.indexOf(`STATUS ${username} `) === 0) {
                resolve(message.slice(-1) === '3');
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
bot.on('privmsg', _.partial(executeCommands, 'message'));
bot.on('join', ({channel, nick}) => executeCommands('join', nick, channel));
bot.on('action', _.partial(executeCommands, 'action'));
bot.on('mode', ({target, nick, modes}) => {
    modes.forEach((mode) => {
        executeCommands(`mode ${mode.mode}`, nick, target, mode.param);
    });
});

function executeTask(taskName) {
  const params = tasks[taskName];
  const iteratee = params.concurrent ? params.task : _.once(params.task);
  _.forOwn(config.irc.tasks, (channelConfig, channel) => {
    if (checkEnabled(channel, taskName, channelConfig)) {
      outputResponse(channel, iteratee({bot, channel: params.concurrent ? channel : null}));
    }
  });
}

bot.on('join', () => {
  _.forOwn(tasks, (params, taskName) => {
    if (params.onStart) {
      executeTask(taskName);
    }
    setInterval(executeTask, params.period * 1000, taskName);
  });
});
