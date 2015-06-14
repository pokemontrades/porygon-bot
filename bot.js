var irc = require('irc');
var mysql = require('mysql');
var config = require('./config');

var db = mysql.createConnection({
    host: config.dbHost,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.database,
    timezone: 'Europe/London'
});

var functionalChans = config.channels;

var bot = new irc.Client(config.server, config.nick, {
    userName: config.userName,
    realName: config.realName,
    port: config.port,
    secure: config.secure,
    selfSigned: config.selfSigned,
    certExpired: config.certExpired,
    encoding: 'UTF-8',
    password: config.password
});

var commands = config.commands;

bot.on('error', function(e) {
    console.log(e);
});

db.connect(function(e) {
    if (e) {
        console.error('error connecting: ' + e.stack);
    }
});

function getMain(nick, callback) {
    db.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?',
        ['%'+nick+'%'], function(err, result) {
            if (err) console.log(err);
            callback(result[0]);
        });
}

function getMessage(line) {
    var sub = line.substring(5);
    var space = sub.indexOf(" ");
    return [sub.substring(0, space), sub.substring(space+1)];
}

function error(chan) {
    bot.say(chan, 'There was an error. Do I even know that person?');
}

var highFive1;
var highFive2;

function hf1(chan, u2) {
    bot.say(chan, highFive1 + ' o/\\o ' + u2);
    highFive1 = undefined;
}

function hf2(chan, u2) {
    bot.say(chan, u2 + ' o/\\o ' + highFive2);
    highFive2 = undefined;
}

bot.addListener('message', function(sender, chan, text) {
    checkMessages(chan, sender);

    if (text.indexOf('!msg') == 0) {
        var message = getMessage(text);

        // no empty messages
        if (message[0] && message[1].trim().length > 0) {
            var sql;
            var params;
            var user = message[0];
            var text = message[1];
            getMain(user, function(mainInfo) {
                if (mainInfo) {
                    if (functionalChans.indexOf(chan) > -1) { // not a PM
                        sql = 'INSERT INTO Message (TargetID, SenderName, MessageText) VALUES ' +
                        '(?, ?, ?)';
                        params = [mainInfo.UserID, sender, text];
                    } else if (chan == config.nick) { // PM
                        sql = 'INSERT INTO Message (TargetID, SenderName, MessageText, IsPrivate) VALUES ' +
                        '(?, ?, ?, ?)';
                        params = [mainInfo.UserID, sender, text, 1];
                        chan = sender;
                    }

                    db.query(sql, params, function (err) {
                        if (err) {
                            console.log(err);
                            error(chan);
                        } else {
                            bot.say(chan, "Saved message for " + mainInfo.MainNick + ". Beep boop.");
                        }
                    });
                } else {
                    error(chan);
                }
            });
        }
    } else { // end of !msg
        if (functionalChans.indexOf(chan) > -1) {
            if (text.indexOf('o/') != -1) {
                if (highFive2) {
                    hf2(chan, sender);
                } else {
                    highFive1 = sender;
                }
            } else if (text.indexOf('\\o') != -1) {
                if (highFive1) {
                    hf1(chan, sender);
                } else {
                    highFive2 = sender;
                }
            } // end of high fives

            text = text.toLowerCase();
            if (text.indexOf('gib pokélist') != -1 || text.indexOf('gib pokelist') != -1) {
                bot.say(chan, "http://i.imgur.com/xixihlD.png (づ￣ ³￣)づ");
            }

            // . commands
            if (text.indexOf('.') == 0) {
                if (commands[text]) {
                    bot.say(chan, commands[text]);
                }
            }

        }
    }
});

bot.addListener('join', function(chan, nick) {
    if (functionalChans.indexOf(chan) > -1) {
        checkMessages(chan, nick);
    }
});

var friendlyNicks = config.friendly;

bot.addListener('action', function(sender, chan, text) {
    if (text.indexOf('pets ' + config.nick) > -1) {
        if (friendlyNicks.indexOf(sender) > -1) {
            bot.say(chan, 'n_n');
        } else {
            bot.say(chan, 'NO TOUCHING');
        }
    }
});

function checkMessages(chan, nick) {
    db.query('SELECT * from Message M ' +
    'JOIN User U ON M.TargetID = U.UserID ' +
    'JOIN Nick N ON U.UserID = N.UserID ' +
    'WHERE N.Nickname LIKE ? GROUP BY M.MessageID', ['%'+nick+'%'], function(error, results) {
        for (var i in results) {
            var message = results[i];
            var to = (message.IsPrivate) ? nick : chan;
            bot.say(to, nick + ": " + message.MessageText + " (from " +
            message.SenderName + ", " + message.MessageDate + " UTC)");
            db.query('DELETE FROM Message WHERE MessageID = ' + message.MessageID, function(err, result) {
                if (err) console.log(err);
                console.log('deleted ' + result.affectedRows + ' rows');
            });

        }
    });
}