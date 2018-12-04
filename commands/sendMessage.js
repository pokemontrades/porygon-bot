'use strict';
const db = require('../services/db');
const Op = require('sequelize').Op;

module.exports = {
  db_required: true,
  message_regex: /^[\.!](?:msg|tell|ask)\s+([^ ]+)\s+([^\s].*)$/,
  allow: ({isMod, isAuthenticated}) => isMod && isAuthenticated,
  response ({bot, message_match: [, recipient, text], author_match: [author], channel}) {
    // no sending to the bot
    if (recipient.toLowerCase() === bot.nick.toLowerCase()) {
      return {response_type: 'action', message: `slaps ${author}.`};
    }
    return db.models.Alias.findOne({where: {Alias: {[Op.eq]: recipient}}})
        .then((results) => results ? results.get('UserID') : Promise.reject())
        .then((UserID) => db.models.Message.create({TargetID: UserID, SenderName: author, MessageText: text, Location: channel}))
        // Sequelize doesn't allow you to join for the result returned from create, so we need to get the user to get the mainnick
        .then((message) => db.models.Message.findById(message.get('MessageID'), {include: [db.models.User]}))
        .then((message) => `Saved message for ${message.get('User', {plain: true}).MainNick}. Beep boop.`)
        .catch((err) => {
          console.log(`Error: ${err}`);
          return 'There was an error. Do I even know that person?';
        });
  }
};
