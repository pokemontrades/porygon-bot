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
    userName: config.username,
    realName: config.realname,
    port: config.port,
    secure: true,
    selfSigned: true,
    certExpired: true,
    encoding: 'UTF-8',
    password: config.password
});

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

bot.addListener('message', function(sender, chan, line) {
    if (line.indexOf('!msg') == 0) {
        var message = getMessage(line);

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

    }
});

bot.addListener('join', function(chan, nick) {
    if (functionalChans.indexOf(chan) > -1) {
        db.query('SELECT * from Message M ' +
        'JOIN User U ON M.TargetID = U.UserID ' +
        'JOIN Nick N ON U.UserID = N.UserID ' +
        'WHERE N.Nickname LIKE ?', ['%'+nick+'%'], function(error, results) {
            for (var i in results) {
                var message = results[i];
                var to = (message.IsPrivate == 1) ? nick : chan;
                bot.say(to, nick + ": " + message.MessageText + " (from " +
                message.SenderName + ", " + message.MessageDate + " UTC)");
                var msgid = message.MessageID;
                db.query('DELETE FROM Message WHERE MessageID = ' + msgid, function(err, result) {
                    if (err) console.log(err);
                    console.log('deleted ' + result.affectedRows + ' rows');
                });

            }
        });
    }
});


var highFive1;
var highFive2;

bot.addListener('message', function(nick, chan, msg) {
    if (functionalChans.indexOf(chan) > -1) {
        if (msg.indexOf('o/') != -1) {
            if (highFive2) {
                hf2(chan, nick);
            } else {
                highFive1 = nick;
            }
        } else if (msg.indexOf('\\o') != -1) {
            if (highFive1) {
                hf1(chan, nick);
            } else {
                highFive2 = nick;
            }
        }
    }
});

function hf1(chan, u2) {
    bot.say(chan, highFive1 + ' o/\\o ' + u2);
    highFive1 = undefined;
}

function hf2(chan, u2) {
    bot.say(chan, u2 + ' o/\\o ' + highFive2);
    highFive2 = undefined;
}