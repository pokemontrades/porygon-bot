var irc = require('irc');
var mysql = require('mysql');
var config = require('./config');
var sha1 = require('node-sha1');
var ball_data = require('./ball_data')
var ball_types = ['poké','great','ultra','master','net','dive','nest','repeat','timer','luxury','premier','dusk','heal','quick','safari','apricorn','sport','dream','cherish'];
var apricorns = ['fast','level','lure','heavy','love','friend','moon'];

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
    // channels: config.channels,
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
    var start = 5;
    if (line.indexOf('tell') == 1) start++;
    var sub = line.substring(start);
    var space = sub.indexOf(" ");
    return [sub.substring(0, space), sub.substring(space+1)];
}

function saveMessage(chan, sql, params, nick) {
    db.query(sql, params, function (err) {
        if (err) {
            console.log(new Date().toString(), err);
            error(chan);
        } else {
            bot.say(chan, "Saved message for " + nick + ". Beep boop.");
        }
    });
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
            db.query('DELETE FROM Message WHERE MessageID = ' + message.MessageID, function(err, result) {
                if (err) console.log(err);
            });

        }
    });
}

function validate_fc(fc) {
    fc = fc.replace(/-/g,'');
    if (!fc.match(/^\d{12}$/) || fc > 549755813887) {
        return 0;
    }
    var checksum = Math.floor(fc/4294967296);
    var byte_seq = (fc % 4294967296).toString(16)
    while (byte_seq.length < 8) { byte_seq = "0"+byte_seq; }
    var byte_arr = byte_seq.match(/../g).reverse();
    var hash_seq = ""
    for (var i = 0; i < 4; i++) {
        hash_seq += String.fromCharCode(parseInt(byte_arr[i],16));
    }
    var new_chk = (parseInt(sha1(hash_seq).substring(0,2),16) >> 1);
    return (new_chk == checksum)?1:0;
}

bot.addListener('message', function(sender, chan, text) {
    checkMessages(chan, sender);

    // !msg
    if (text.indexOf('msg') == 1 || text.indexOf('tell') == 1) {
        var message = getMessage(text);

        // no empty messages
        if (message[0] && message[1].trim().length > 0) {
            var sql;
            var params;
            var user = message[0];
            var text = message[1];

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
                            }); // make sure the sender is a mod
                        }

                    } else {
                        error(chan);
                    }
                });
            }


        }
    } else { // end of !msg
        text = text.toLowerCase();
        var to = (functionalChans.indexOf(chan) > -1) ? chan : sender;
        if (functionalChans.indexOf(chan) > -1) {
            if (text.indexOf('\\o/') == -1) {
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
            }
            
            if (text.indexOf('gib pokélist') != -1 || text.indexOf('gib pokelist') != -1) {
                bot.say(chan, "http://i.imgur.com/xixihlD.png (づ￣ ³￣)づ");
            }
        }

        // . commands
        if (text.indexOf('.') == 0) {
            if (text.indexOf('checkfc ') == 1) {
                var fc = text.substr(9).trim();
                if (!fc.match(/^\d{4}-?\d{4}-?\d{4}$/)) {
                    bot.say(to, 'The input given was not in a valid friend code format.')
                } else {
                    bot.say(to, 'Friend code: '+fc+' - Valid? '+(validate_fc(fc) ? 'YES':'NO'));
                }
            } else if (text.indexOf('checkball ') == 1) {
                var params = text.substr(11).trim().split(' ');
                var formatted_limitations = function (data) {
                    if (!data[1] && !data[2]) {
                        return '* (Cannot be bred)';
                    }
                    if (!data[1]) {
                        return '*';
                    }
                    if (!data[2]) {
                        return ' (Cannot be bred)';
                    }
                    return '';
                }
                if (params.length == 1) {
                    var species = params[0];
                    if (species === "nidoran-m") species = "nidoran♂";
                    if (species === "nidoran-f") species = "nidoran♀";
                    if (ball_data[species]) {
                        var response = 'Legal balls for ' + species.slice(0,1).toUpperCase() + species.slice(1) + ': ';
                        var legality_data = parseBallLegality(ball_data[species]);
                        var ha_data = '';
                        var breeding_data = '';
                        for (var ball in legality_data) {
                            ha_data += legality_data[ball][1]?'1':'0';
                            breeding_data += legality_data[ball][2]?'1':'0';
                        }
                        for (var ball in legality_data) {
                            if (legality_data[ball][0]) {
                                response += ball.slice(0,1).toUpperCase() + ball.slice(1);
                                if (ha_data === '0000000000000000000') { //19 zeros
                                    legality_data[ball][1] = true;
                                }
                                if (breeding_data.slice(1) === '000000000000000000') { //18 zeros
                                    legality_data[ball][2] = true;
                                }
                                response += formatted_limitations(legality_data[ball]);
                                response += ', '
                            }
                        }
                        response = response.slice(0, -2) + ' ';
                        if (ha_data === '0000000000000000000') { //19 zeros
                            response += '(HA illegal in all balls) ';
                        } else if (response.indexOf('*') != -1) {
                            response += '(* = HA Illegal) ';
                        }
                        if (breeding_data === '0000000000000000000') { //19 zeros
                            response += ' (Cannot be bred in any ball) ';
                        } else if (breeding_data === '1000000000000000000') { //1 followed by 18 zeros
                            response += ' (Can only be bred in Poké Ball) ';
                        }
                        bot.say(to, response.trim());
                    } else {
                        bot.say(to, "No Pokémon data found for '" + params[0] + "'.");
                    }
                } else if (params.length == 2 || (params.length == 3 && params[2] === 'ball')) {
                    var species = params[0];
                    var ball = params[1];
                    if (ball.indexOf("poke") != -1) ball = "poké";
                    if (species === "nidoran-m") species = "nidoran♂";
                    if (species === "nidoran-f") species = "nidoran♀";
                    if (ball_types.indexOf(ball) == -1 && apricorns.indexOf(ball) == -1) {
                        bot.say(to, "Ball type '" + ball + "' not recognized.");
                    }
                    else if (ball_data[species]) {
                        var legality_data = parseBallLegality(ball_data[species]);
                        var formattedSpecies = species.slice(0,1).toUpperCase() + species.slice(1);
                        var formattedBall = ball.slice(0,1).toUpperCase() + ball.slice(1) + ' Ball '
                        var response = formattedBall + formattedSpecies + ' - Legal? ' + (legality_data[ball][0]?'YES':'NO');
                        if (legality_data[ball][0]) {
                            response += formatted_limitations(legality_data[ball]).replace('*', ' (HA illegal)');
                        }
                        bot.say(to, response);
                    } else {
                        bot.say(to, "No Pokémon data found for '" + params[0] + "'.");
                    }
                } else {
                    bot.say(to, "Usage: .checkball <Pokémon> [balltype]");
                }
            } else {
                text = text.trim();
                if (commands[text]) {
                    bot.say(chan, commands[text]);
                }
            }
        }
    }
});

var parseBallLegality = function (compressed) {
    var data = {};
    for (var i = 0; i < ball_types.length; i++) {
        var binary = parseInt(compressed.charAt(i)).toString(2);
        if (ball_types[i] === 'apricorn') {
            for (var j = 0; j < apricorns.length; j++) {
                data[apricorns[j]] = [binary.charAt(0) === '1', binary.charAt(1) === '1', binary.charAt(2) === '1'];
            }
        } else {
            data[ball_types[i]] = [binary.charAt(0) === '1', binary.charAt(1) === '1', binary.charAt(2) === '1'];
        }
    }
    return data;
}

bot.addListener('join', function(chan, nick) {
    if (functionalChans.indexOf(chan) > -1) {
        checkMessages(chan, nick);
    }
});

bot.addListener('action', function(sender, chan, text) {
    checkMessages(chan, sender);

    if (text.indexOf('pets ' + config.nick) > -1) {
        bot.say(chan, 'n_n');
    }
});