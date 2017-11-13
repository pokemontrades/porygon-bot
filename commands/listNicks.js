'use strict';
const db = require('../services/db');

module.exports = {
  db_required: true,
  message_regex: /^\.listnicks(?: ([^ ]+))?/i,
  allow: ({isMod, isAuthenticated}) => isMod && isAuthenticated,
  response: function ({message_match: [, targetUser], author_match: [author]}) {
    targetUser = targetUser || author;

    return db.getMain(targetUser, (targetUserMain) => {
      if (!targetUserMain) {
        return 'There was an error. Do I even know that person?';
      }

      return db.conn.query(
        'SELECT Nickname FROM Nick N WHERE N.UserID = (SELECT N.UserID FROM Nick N WHERE N.Nickname LIKE ? LIMIT 1)',
        [`%${targetUser}%`]).then(results => {
          return `Nicknames for ${targetUserMain.MainNick}: ${results.map(result => result.Nickname).join(', ')}`;
      });
    });
  }
};
