'use strict';
const db = require('../services/db');

module.exports = {
  db_required: true,
  message_regex: /^[\.!](?:msg|tell|ask)\s+([^ ]+)\s+([^\s].*)$/,
  allow: ({isMod, isAuthenticated}) => isMod && isAuthenticated,
  response ({bot, message_match: [, recipient, text], author_match: [author], channel}) {
    // no sending to the bot
    if (recipient.toLowerCase() === bot.nick.toLowerCase()) {
      return {response_type: 'action', message: `slaps ${author}.`};
    }
    return db.conn.query('SELECT * FROM User U JOIN Alias A ON U.UserID = A.UserID WHERE A.Alias = ?', [`${recipient}`]).get(0).then(recipientInfo => {
      if (!recipientInfo) {
        return 'There was an error. Do I even know that person?';
      }
      return db.conn.query(
        'INSERT INTO Message (TargetID, SenderName, MessageText, Location) VALUES (?, ?, ?, ?)',
        [recipientInfo.UserID, author, text, channel]
      ).return(`Saved message for ${recipientInfo.MainNick}. Beep boop.`);
    });
  }
};
