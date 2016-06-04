var db = require('../services/db');
var moment = require('moment');

module.exports = {
  db_required: true,
  message_regex: /^.*$/,
  events: ['message','join','action'],
  response: function ({bot, message_match, author_match, channel, isAuthenticated, eventType}) {
    var prompt = message_match[0];
    var author = author_match[0];
    var responses = [];
    // !msg
    if (prompt.toLowerCase().indexOf('msg') == 1 || prompt.toLowerCase().indexOf('tell') == 1 || prompt.toLowerCase().indexOf('ask') == 1) {
        var message = getMessage(prompt);

        // no empty messages
        if (message[0] && message[1].trim().length > 0) {
            var sql;
            var params;
            var user = message[0];
            var text = message[1];

            // no sending to the bot
            if (user.toLowerCase() == bot.nick.toLowerCase()) {
                return {'response_type': 'action', 'message': 'slaps ' + author + '.'};
            } else {
                responses.push(getMain(user, function(mainInfo) {
                    if (mainInfo) {
                        if (!isAuthenticated) {
                            return "You must be authenticated to NickServ in order to use this command.";
                        } else {
                            return getMain(author, function(senderInfo) {
                                if (senderInfo) {
                                    sql = 'INSERT INTO Message (TargetID, SenderName, MessageText, Location) VALUES ' +
                                    '(?, ?, ?, ?)';
                                    params = [mainInfo.UserID, author, text, channel];
                                    return saveMessage(sql, params, mainInfo.MainNick);
                                }
                            });
                        }
                    } else {
                        return 'There was an error. Do I even know that person?';
                    }
                }));
            }
        }
    }
    if (isAuthenticated) {
        responses.push(checkMessages(author, bot, eventType === 'join' ? channel : null));
    }
    return responses;
  }
};

/*
 * Retrieves main IRC nick for the given nickname.
 */
function getMain(nick, callback) {
    return db.conn.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?',
        ['%'+nick+'%']).then(function(result) {
            return callback(result[0]);
        }).catch(function(err) {
            console.log(err);
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
function saveMessage(sql, params, nick) {
    return db.conn.query(sql, params).then(function() {
        return "Saved message for " + nick + ". Beep boop.";
    }).catch(function(err) {
        console.log(new Date().toString(), err);
        return 'There was an error. Do I even know that person?';
    });
}

/*
 * Checks and delivers messages for the given user.
 */
function checkMessages(nick, bot, channel) {
    return db.conn.query('SELECT * from Message M ' +
    'JOIN User U ON M.TargetID = U.UserID ' +
    'JOIN Nick N ON U.UserID = N.UserID ' +
    'WHERE N.Nickname LIKE ? GROUP BY M.MessageID', ['%'+nick+'%']).then(function(results) {
        var output_messages = [];
        for (var i in results) {
            var message = results[i];
            var target_channel = message.Location;
            if (message.Location.indexOf("#") != 0) {
                target_channel = nick;
            } else if (!(nick in bot.chans[message.Location].users) || channel && channel !== target_channel) {
                continue;
            }
            var output = nick + ": " + message.MessageText + " (from " +
                message.SenderName + ", " + moment(message.MessageDate).utcOffset(message.Timezone).format('YYYY-MM-DD HH:mm:ss UTCZZ')+")";
            output_messages.push({'response_type': 'text', 'target': target_channel, 'message': output});
            db.conn.query('DELETE FROM Message WHERE MessageID = ' + message.MessageID, function(err) {
                if (err) console.log(err);
            });
        }
        return output_messages;
    }).catch(function(err) {
        console.log("An error occurred: \n"+err);
    });
}
