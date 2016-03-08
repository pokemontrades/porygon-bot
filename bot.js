'use strict';
var irc = require('irc');
var mysql = require('promise-mysql');
var config = require('./config');
var db = require('./services/db');
var commands = require('./commands');

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

var functionalChans = config.channels;

var bot = new irc.Client(config.server, config.nick, {
    userName: config.userName,
    realName: config.realName,
    channels: config.channels,
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
function executeCommands (event, author, chan, text) {
    let isPM = chan === bot.nick;
    let target = isPM ? author : chan;
    let checkMod, checkAuth; // Don't check whether the user is a mod or identified unless they actually trigger a command
    for (let i in commands[event]) {
        let message_match = commands[event][i].message_regex && commands[event][i].message_regex.exec(text);
        let author_match = (commands[event][i].author_regex || /.*/).exec(author);
        if (message_match && author_match && author !== bot.nick) {
            checkMod = checkMod || checkIfUserIsMod(author);
            checkAuth = checkAuth || checkAuthenticated(author);
            Promise.all([checkMod, checkAuth]).then(function (results) {
                if ((commands[event][i].allow || defaultAllow)({
                    isPM: isPM,
                    isMod: results[0],
                    isAuthenticated: results[1]
                })) {
                    outputResponse( target, commands[event][i].response({
                        bot: bot,
                        message_match: message_match,
                        author_match: author_match,
                        channel: chan,
                        isMod: results[0],
                        isAuthenticated: results[1]
                    }));
                }
            }).catch(function (error) {
                handleError(target, error);
            });
        }
    }
}

function handleError (target, error) {
    if (error.error_message) {
        outputResponse(target, error.error_message);
    }
    if (error.stack) {
        console.log(error.stack);
    }
}

function checkIfUserIsMod (username) { // Returns a Promise that will resolve as true if the user is in the mod database, and false otherwise
    if (config.disable_db || db.conn == null) {
        return Promise.resolve(true);
    }
    return db.conn.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?', ['%' + username + '%']).then(function (res) {
        return !!res.length;
    });
}

function checkAuthenticated (username) { // Returns a Promise that will resolve as true if the user is identified, and false otherwise
    bot.say('NickServ', 'STATUS ' + username);
    var awaitResponse = function (resolve) {
        bot.once('notice', function (nick, to, text) {
            if (nick === 'NickServ' && to === bot.nick && text.indexOf('STATUS ' + username + ' ') === 0) {
                resolve(text.slice(-1) === '3');
            } else { // The notice was something unrelated, set up the listener again
                resolve(new Promise(awaitResponse));
            }
        });
    };
    var timeout = new Promise(function (resolve, reject) { // Reject the promise if NickServ hasn't replied after 5 seconds
        setTimeout(reject, 5000, 'Timed out waiting for NickServ response');
    });
    return Promise.race([new Promise(awaitResponse), timeout]);
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
