'use strict';
const _ = require('lodash');
const Promise = require('bluebird');
const REGISTERED_NICK_REGEX = /(?:~R:)?([a-zA-Z\[\]\\`_\^\{\|\}][a-zA-Z0-9\[\]\\`_\^\{\|\}-]{1,31})(?:!\*@\*)?/;
module.exports = {
  period: 60 * 60 * 24,
  task ({bot, channel}) {
    const memoizedCheck = _.memoize(_.partial(checkNickRegistered, bot));
    return getInviteList(bot, channel)
      .filter(isValidNick)
      .filter(nick => memoizedCheck(nick.replace(REGISTERED_NICK_REGEX, '$1')).then(isRegistered => !isRegistered))
      .each(nick => unInvite(bot, channel, nick))
      .return();
  }
};

/* Gets the invite list for a given `channel`.
** Returns a Promise that fulfills with an Array of masks */
function getInviteList (bot, channel) {
  let resolvePromise;
  const names = [];
  const parseMessage = message => {
    if (_.includes([346, 347], +message.command) && Array.isArray(message.args) && message.args[0] === bot.nick && message.args[1] === channel) {
      if (message.args[2] === 'End of Channel Invite List') {
        resolvePromise(names);
      } else {
        names.push(message.args[2]);
      }
    }
  };
  return new Promise(resolve => {
    resolvePromise = resolve;
    bot.send('mode', channel, '+I');
    bot.on('raw', parseMessage);
  }).timeout(10000, 'Timed out while retrieving channel invite list').finally(() => bot.removeListener('raw', parseMessage));
}

/*
** Returns `true` if the given `mask` is a valid nick; otherwise, returns `false`.
** In this context, a "valid nick" is defined as a mask that contains a nick, no ident, and no host.
** Porygon-Bot will only remove masks from the invite list if they are valid nicks.
** Valid nicks:
**   not_an_aardvark
**   ~R:not_an_aardvark
**   not_an_aardvark!*@*
**   ~R:not_an_aardvark!*@*
** Invalid nicks:
**   *!*@12345678.12345678.12345678.IP
**   not_an_aardvark!naa@*
*/
function isValidNick (mask) {
  return REGISTERED_NICK_REGEX.test(mask);
}

let throttle = Promise.resolve();
const THROTTLE_DELAY = 1000;

/* Throttles requests by returning Promises. If this function is called 5 times, the first returned Promise will fulfill
** immediately, the second returned Promise will fulfill after 1 second, the third returned Promise will fulfill after 2
** seconds, etc. This ensures that the bot doesn't get kicked for excess flood, or something to that effect. */
function waitForThrottle () {
  if (throttle.isFulfilled()) {
    throttle = Promise.delay(THROTTLE_DELAY);
    return Promise.resolve();
  }
  return throttle.then(waitForThrottle);
}

/* Checks whether the given `nick` is registered with NickServ.
** Returns a Promise that fulfills with `true` if the nick is registered, or `false` if the nick is not registered. */
function checkNickRegistered (bot, nick) {
  bot.say('NickServ', `INFO ${nick}`);
  const awaitResponse = () => {
    return new Promise(resolve => {
      bot.once('notice', (from, to, text) => {
        /*
        ** Expected responses:
        **   if the nick isn't registered:
        **     `Nick \x02${nick}\x02 isn't registered.`
        **   if the nick is registered:
        **     `${nick} is ${realName} ... (other info)`
        */
        const NOT_REGISTERED_RESPONSE = /^Nick \x02([a-zA-Z\[\]\\`_\^\{\|\}][a-zA-Z0-9\[\]\\`_\^\{\|\}-]{1,31})\x02 isn't registered\.$/;
        const REGISTERED_RESPONSE = /^([a-zA-Z\[\]\\`_\^\{\|\}][a-zA-Z0-9\[\]\\`_\^\{\|\}-]{1,31}) is /;
        const notRegisteredMatch = text.match(NOT_REGISTERED_RESPONSE);
        const registeredMatch = text.match(REGISTERED_RESPONSE);
        const match = notRegisteredMatch || registeredMatch;
        return resolve(from === 'NickServ' && to === bot.nick && match && match[1].toLowerCase() === nick.toLowerCase() ? !!registeredMatch : awaitResponse());
      });
    });
  };
  return waitForThrottle()
    .then(() => bot.say('NickServ', `INFO ${nick}`))
    .then(() => awaitResponse().timeout(10000, `Timed out waiting for NickServ response to see whether the nick '${nick}' is registered`));
}

/* Removes the given `nick` from `channel`'s invite list.
** Returns a Promise that fulfills when the removal has been completed successfully, or rejects if an error occurs. */
function unInvite (bot, channel, nick) {
  bot.send('mode', channel, '-I', nick);
  return Promise.resolve(); // TODO: Add better error handling if a user cannot be removed for some reason
}
