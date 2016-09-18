'use strict';
const db = require('../services/db');

module.exports = {
  db_required: true,
  message_regex: /^\.addnick ([^ ]+)(?: ([^ ]+))?/i,
  allow: ({isMod, isAuthenticated}) => isMod && isAuthenticated,
  response: function ({message_match: [, newNick, targetUser], author_match: [author], isAuthenticated}) {
    if (!isAuthenticated) {
      return 'You must be authenticated to use this command.';
    }
    targetUser = targetUser || author;

    return db.conn.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?', [targetUser]).get(0).then(targetUserMain => {
      if (!targetUserMain) {
        return 'There was an error. Do I even know that person? (You might have switched the parameters.)';
      }

      return db.conn.query(
        'INSERT INTO Nick (UserID, Nickname) VALUES (?, ?)',
        [targetUserMain.UserID, newNick])
        .return(`Added nick shortcut "${newNick}" for ${targetUserMain.MainNick}.`)
        .catch(err => {
          if (err.code == 'ER_DUP_ENTRY') {
            return `The nick "${newNick}" already exists.`;
          }
        });


    });
  }
};
