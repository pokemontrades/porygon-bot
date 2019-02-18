'use strict';
const db = require('../services/db');
const moment = require('moment');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

module.exports = {
  db_required: true,
  events: ['message', 'join', 'action'],
  allow: ({isAuthenticated}) => isAuthenticated,
  response ({author_match: [nick], channel, eventType}) {
    return db.models.Message.findAll({
        // Filter out any message that doesn't have a user (we can't refer to "User" on it's own because we can only refer to fields, not tables)
        where: {'$User.MainNick$': {[Op.ne]: null}},
        include: [{
            model: db.models.User, include: [{
                model: db.models.Alias,
                where: {Alias: {[Op.eq]: nick}}
            }]
        }]})
        .map((messageResult) => {
          const message = messageResult.get({plain: true});
          console.log(message);
            if (channel === message.Location || !message.Location.startsWith('#')) {
              return db.models.Message
                  .destroy({where: {MessageID: {[Op.eq]: message.MessageID}}})
                  .return(`${nick}: ${message.MessageText} (from ${message.SenderName}, ${formatTimestamp(message)})`);
            } else if (eventType !== 'join' && !message.UserNotified) {
                return db.models.Message
                    .update({UserNotified: true}, {where: {MessageID: {[Op.eq]: message.MessageID}}})
                    .return({
                        response_type: 'text',
                        target: nick,
                        message: `You have a message from ${message.SenderName} in ${message.Location} (sent at ${formatTimestamp(message)}).`
                    });
            }
        });
  }
};

function formatTimestamp (message) {
  return moment(message.MessageDate || message.created_at).utcOffset(message.User.Timezone).format('YYYY-MM-DD HH:mm:ss UTCZZ');
}
