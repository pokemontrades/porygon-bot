'use strict';
const db = require('../services/db');
const moment = require('moment');
module.exports = {
  db_required: true,
  events: ['message', 'join', 'action'],
  allow: ({isAuthenticated}) => isAuthenticated,
  response ({bot, author_match: [nick], channel, eventType}) {
    return db.conn.query(
      'SELECT * FROM Message M JOIN User U ON M.TargetID = U.UserID JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ? GROUP BY M.MessageID',
      [`%${nick}%`]
    ).filter(message => (channel === message.Location || eventType !== 'join') && (!message.Location.startsWith('#') || {}.hasOwnProperty.call(bot.chans[message.Location].users, nick)))
    .each(message => db.conn.query(`DELETE FROM Message WHERE MessageID = ${message.MessageID}`))
    .map(message => ({
      response_type: 'text',
      target: message.Location.startsWith('#') ? message.Location : nick,
      message: `${nick}: ${message.MessageText} (from ${message.SenderName}, ${moment(message.MessageDate).utcOffset(message.Timezone).format('YYYY-MM-DD HH:mm:ss UTCZZ')})`
    }));
  }
};
