'use strict';
const db = require('../services/db');

module.exports = {
  db_required: true,
  message_regex: /^[\.!](?:msg|tell|ask)\s+([^ ]+)\s+([^\s].*)$/,
  allow: ({isMod, isAuthenticated}) => isMod && isAuthenticated,
  response ({bot, message_match: [, user, text], author_match: [author], channel}) {
    // no sending to the bot
    if (user.toLowerCase() === bot.nick.toLowerCase()) {
      return {response_type: 'action', message: `slaps ${author}.`};
    }
    return db.conn.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?', [`%${user}%`]).get(0).then(mainInfo => {
      if (!mainInfo) {
        return 'There was an error. Do I even know that person?';
      }
      return db.conn.query(
        'INSERT INTO Message (TargetID, SenderName, MessageText, Location) VALUES (?, ?, ?, ?)',
        [mainInfo.UserID, author, text, channel]
      ).return(`Saved message for ${mainInfo.MainNick}. Beep boop.`);
    });
  }
};
