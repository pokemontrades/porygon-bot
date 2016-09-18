'use strict';
const db = require('../services/db');

module.exports = {
  db_required: true,
  message_regex: /^\.removenick ([^ ]+)/i,
  allow: ({isMod, isAuthenticated}) => isMod && isAuthenticated,
  response: function ({message_match: [, nick], author_match: [author], isAuthenticated}) {
    if (!isAuthenticated) {
      return 'You must be authenticated to use this command.';
    }

    return db.getMain(nick, (targetUserMain) => {
      if (!targetUserMain) {
        return 'There was an error. Do I even know that person?';
      }
      if (nick.toLowerCase() === author.toLowerCase()) {
        return 'You cannot delete your current nick.';
      }

      return db.getMain(author, (authorMain) => {
        if (authorMain.UserID !== targetUserMain.UserID) {
          return 'You can only remove your own nicks.';
        }

        return db.conn.query(
          'DELETE FROM Nick WHERE Nickname = ?',
          [nick])
          .then(result => {
            return result.affectedRows == 0 ? 'That nick does not exist.' :`Deleted nick shortcut "${nick}".`;
          })
          .catch(err => {
            console.log(err.code);
          });
      });

    });
  }
};
