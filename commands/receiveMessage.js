'use strict';
const db = require('../services/db');
const moment = require('moment');
module.exports = {
  db_required: true,
  events: ['message', 'join', 'action'],
  allow: ({isAuthenticated}) => isAuthenticated,
  response ({author_match: [nick], channel, eventType}) {
    return db.conn.query(
      'SELECT * FROM Message M JOIN User U ON M.TargetID = U.UserID JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ? GROUP BY M.MessageID',
      [`%${nick}%`]
    ).map(message => {
      if (channel === message.Location || !message.Location.startsWith('#')) {
        return db.conn.query(`DELETE FROM Message WHERE MessageID = ${message.MessageID}`).return({
          response_type: 'text',
          target: message.Location.startsWith('#') ? message.Location : nick,
          message: `${nick}: ${message.MessageText} (from ${message.SenderName}, ${formatTimestamp(message)})`
        });
      }
      if (eventType !== 'join' && !message.UserNotified) {
        return db.conn.query('UPDATE Message SET UserNotified = TRUE WHERE MessageID = ?', [message.MessageID]).return({
          response_type: 'text',
          target: nick,
          message: `You have a message from ${message.SenderName} in ${message.Location} (sent at ${formatTimestamp(message)}).`
        });
      }
    });
  }
};

function formatTimestamp (message) {
  return moment(message.MessageDate).utcOffset(message.Timezone).format('YYYY-MM-DD HH:mm:ss UTCZZ');
}
