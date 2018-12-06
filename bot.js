'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
var config = require('./config');
var db = require('./services/db');
var commands = require('./commands');
const tasks = require('./tasks');
const warn = _.memoize(console.warn);
const bot = require('./services/irc').setUp(config.irc);
const client = require('./services/discord').client;

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

// Connect to Discord
if (config.discord.enabled && config.discord.token) {
  client.login(config.discord.token);
}

function outputResponse(target, messages, richMessages) {
    if (!messages) {
        return;
    }
    if (typeof messages === 'string') {
        sendMessage(target, messages, richMessages);
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
                sendMessage(target, messages['message']);
                break;
            case 'action':
                bot.action(target, messages['message']);
                break;
            default:
                console.log("Message containing invalid `response_type` passed to outputResponse()");
        }
    } else if (typeof messages === 'object' && messages.hasOwnProperty('text') && messages.hasOwnProperty('richText')) {
      sendMessage(target, messages.text, messages.richText);
    } else {
        throw 'Invalid `messages` argument passed to outputResponse()';
    }
}

function sendMessage (target, messages, richMessages) {
  let discordTarget = '';
  if (config.discord.enabled) {
    if (target.match(/\d+/)) {
      discordTarget = target;
      target = config.discord.channels[target];
        }
    else if (findIRCMatch(target)) {
      discordTarget = findIRCMatch(target);
      }
    if (!(richMessages)) {
      richMessages = messages;
      }
  }
  if (target.match(/#\w*/)) {
    bot.say(target, messages);
  }
  if (discordTarget) {
    client.channels.get(discordTarget).send(richMessages);
  }
}

function defaultAllow ({isPM, isMod, isAuthenticated}) { // The default allow() function that gets used for a command if allow() is not provided
    return !isPM || isMod && isAuthenticated;
}

// Main listener for channel messages/PMs
function executeCommands (event, author, channel, text) {
    // Processing Discord-related properties
    if (event.includes("Discord")) {
        author = author.username;
        channel = channel.id;
        event = event.replace('Discord','');
    }
    let isPM = channel === bot.nick;
    let target = isPM ? author : channel;
    for (let i in commands[event]) {
        let message_match = (commands[event][i].message_regex || /.*/).exec(text);
        let author_match = (commands[event][i].author_regex || /.*/).exec(author);
        let itemConfig = config.irc.channels[channel] ? config.irc.channels[channel] : config.irc.channels[config.discord.channels[target]];
        if (message_match && author_match && author !== bot.nick && author !== client.user.username && 
            (isPM || checkEnabled(channel, i, itemConfig))) {
            Promise.join(checkIfUserIsMod(author), checkAuthenticated(author), (isMod, isAuthenticated) => {
                if ((commands[event][i].allow || defaultAllow)({isPM, isMod, isAuthenticated})) {
                    if (commands[event][i].richResponse) {
                    outputResponse(target, commands[event][i].response({bot, message_match, author_match, channel, isMod, isAuthenticated, eventType: event, isPM}),
                                   commands[event][i].richResponse({bot, message_match, author_match, channel, isMod, isAuthenticated, eventType: event, isPM}));
                    }
                    else {
                    outputResponse(target, commands[event][i].response({bot, message_match, author_match, channel, isMod, isAuthenticated, eventType: event, isPM}));
                    }
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
    if (!config.db.enabled || db.conn == null) {
        return Promise.resolve(true);
    }
    return db.conn.query('SELECT * FROM User U JOIN Alias A ON U.UserID = A.UserID WHERE A.Alias = ? AND A.isNick = TRUE', [username]).then(res => !!res.length);
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

function findIRCMatch (ircChannelName) {
    for (let id in config.discord.channels) {
        if (config.discord.channels[id] === ircChannelName) {
            return id;
        }
    }
    return false;
}

bot.on('error', console.error);
bot.on('message', _.partial(executeCommands, 'message'));
bot.on('join', (chan, user) => executeCommands('join', user, chan));
bot.on('action', _.partial(executeCommands, 'action'));
bot.on('+mode', (chan, by, mode, argument) => executeCommands(`mode +${mode}`, by, chan, argument));
bot.on('-mode', (chan, by, mode, argument) => executeCommands(`mode -${mode}`, by, chan, argument));

client.on('message', msg => {executeCommands('messageDiscord', msg.author, msg.channel, msg.content)});

function executeTask(taskName) {
  const params = tasks[taskName];
  const iteratee = params.concurrent ? params.task : _.once(params.task);
  _.forOwn(config.irc.tasks, (channelConfig, channel) => {
    if (checkEnabled(channel, taskName, channelConfig)) {
      outputResponse(channel, iteratee({bot, channel: params.concurrent ? channel : null}));
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
