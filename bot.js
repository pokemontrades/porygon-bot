var irc = require('irc');
var mysql = require('mysql');
var config = require('./config');
var commands = require('./commands');

var db;
if (!config.disable_db) {
    db = mysql.createConnection({
        host: config.dbHost,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.database,
        timezone: 'Etc/UTC'
    });
    db.connect(function (e) {
        if (e) {
            console.error('error connecting: ' + e.stack);
        }
    })
}

var functionalChans = config.channels;

var bot = new irc.Client(config.server, config.nick, {
    userName: config.userName,
    realName: config.realName,
    // channels: config.channels,
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

function say (target, messages) {
    if (!messages) {
        return;
    }
    if (typeof messages === 'string') {
        bot.say(target, messages);
    } else if (Array.isArray(messages)) {
        for (var i = 0; i < messages.length; i++) {
            if (messages[i] && typeof messages[i] !== 'string') {
                throw 'Unexpected ' + typeof messages[i] + ' in message array: ' + messages[i];
            }
            bot.say(target, messages[i])
        }
    } else {
        throw 'Invalid `messages` argument passed to say()';
    }
}

// Main listener for channel messages/PMs
bot.addListener('message', function(sender, to, text) {
    if (!config.disable_db) {
        checkMessages(to, sender);
    }
    var isPM = functionalChans.indexOf(to) === -1;
    for (var i in commands) {
        var message_match = commands[i].message_regex && commands[i].message_regex.exec(text);
        var author_match = (commands[i].author_regex || /.*/).exec(sender);
        if (message_match && author_match && sender !== config.nick) {
            var target = (to === config.nick ? sender : to);
            try {
                say(target, commands[i].response(message_match, author_match, isPM));
            } catch (error) {
                if (error.error_message) {
                    say(target, error.error_message);
                } else {
                    console.error(error.stack);
                }
            }
        }
    }
});

bot.addListener('message', function (sender, chan, text) {

    // !msg
    if (text.toLowerCase().indexOf('msg') == 1 || text.toLowerCase().indexOf('tell') == 1) {
        var message = getMessage(text);

        // no empty messages
        if (message[0] && message[1].trim().length > 0) {
            var sql;
            var params;
            var user = message[0];
            var text = message[1];

            // no sending to the bot
            if (user.toLowerCase() == config.nick.toLowerCase()) {
                bot.action(chan, 'slaps ' + sender + '.');
            } else {
                getMain(user, function(mainInfo) {
                    if (mainInfo) {
                        if (functionalChans.indexOf(chan) > -1) { // not a PM
                            sql = 'INSERT INTO Message (TargetID, SenderName, MessageText) VALUES ' +
                            '(?, ?, ?)';
                            params = [mainInfo.UserID, sender, text];
                            saveMessage(chan, sql, params, mainInfo.MainNick);
                        } else if (chan.toLowerCase() == config.nick.toLowerCase()) { // PM
                            getMain(sender, function(senderInfo) {
                                if (senderInfo) {
                                    sql = 'INSERT INTO Message (TargetID, SenderName, MessageText, IsPrivate) VALUES ' +
                                    '(?, ?, ?, ?)';
                                    params = [mainInfo.UserID, sender, text, 1];
                                    saveMessage(sender, sql, params, mainInfo.MainNick);
                                }
                            });
                        }

                    } else {
                        messageError(chan);
                    }
                });
            }
        }
    }
});

// check user's inbox when they join channel
bot.addListener('join', function(chan, nick) {
    if (functionalChans.indexOf(chan) > -1 && !config.disable_db) {
        checkMessages(chan, nick);
    }
});

// respond cutely to pets
bot.addListener('action', function(sender, chan, text) {
    if (!config.disable_db) {
        checkMessages(chan, sender);
    }

    if (text.indexOf('pets ' + config.nick) > -1) {
        bot.say(chan, 'n_n');
    }
});

bot.addListener('error', function (message) {
    console.error('Error: ', message);
});

/*
 * Retrieves main IRC nick for the given nickname.
 */
function getMain(nick, callback) {
    db.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?',
        ['%'+nick+'%'], function(err, result) {
            if (err) console.log(err);
            callback(result[0]);
        });
}

/*
 * Retrieves message to deliver from a line of chat.
 */
function getMessage(line) {
    var start = 5;
    if (line.toLowerCase().indexOf('tell') == 1) start++;
    var sub = line.substring(start);
    var space = sub.indexOf(" ");
    return [sub.substring(0, space), sub.substring(space+1)];
}

/*
 * Saves message to database.
 */
function saveMessage(chan, sql, params, nick) {
    db.query(sql, params, function (err) {
        if (err) {
            console.log(new Date().toString(), err);
            messageError(chan);
        } else {
            bot.say(chan, "Saved message for " + nick + ". Beep boop.");
        }
    });
}

/*
 * Alerts user that there was an error saving the message.
 */
function messageError(chan) {
    bot.say(chan, 'There was an error. Do I even know that person?');
}

/*
 * Checks and delivers messages for the given user.
 */
function checkMessages(chan, nick) {
    if (chan.toLowerCase() == config.nick.toLowerCase()) {
        chan = nick;
    }
    db.query('SELECT * from Message M ' +
    'JOIN User U ON M.TargetID = U.UserID ' +
    'JOIN Nick N ON U.UserID = N.UserID ' +
    'WHERE N.Nickname LIKE ? GROUP BY M.MessageID', ['%'+nick+'%'], function(error, results) {
        for (var i in results) {
            var message = results[i];
            var to = (message.IsPrivate) ? nick : chan;
            bot.say(to, nick + ": " + message.MessageText + " (from " +
            message.SenderName + ", " + message.MessageDate + " UTC)");
            db.query('DELETE FROM Message WHERE MessageID = ' + message.MessageID, function(err) {
                if (err) console.log(err);
            });

        }
    });
}
