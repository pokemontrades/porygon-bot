'use strict';
const r = require('../services/reddit');
if (!r) {
  return;
}
const usernoteHelper = require('../services/usernote-helper');
const SUBREDDIT = 'pokemontrades';

const SPAM_COOLDOWN = 60 * 60 * 6; // The number of seconds allowed between threads
const TRADE_TYPE_FLAIRS = new Set(['SWSH', 'LGPE', 'SMUSUM', 'XYORAS', 'Home', 'Tradeback', 'Redeem', 'Item', 'Shiny', 'Event']);
const GIVEAWAY_TYPE_FLAIRS = new Set(['Giveaway', 'Contest']);

const threadsByUser = new Map();
const handledThreadIds = new Set();

const getSpamReply = (newThread, oldThread) => `Hello /u/${newThread.author.name},

Sorry, but this thread has been removed because it violates [rule 7](/r/pokemontrades/wiki/rules). In the future, please do not post trade threads more often than once per 6 hours. (Your [other thread](${oldThread.url}) was posted more recently than 6 hours ago.)

*This action was performed by a bot. If you think there was some mistake, please click the "report" button next to this comment, and a human will take a look at your post shortly.*`;

module.exports = {
  period: 60,
  onStart: false,
  task ({bot: {nick}}) {
    return r.getSubreddit(SUBREDDIT).getNew()
      .filter(thread => !handledThreadIds.has(thread.id))
      .then(threads => threads.reverse())
      .each(thread => handledThreadIds.add(thread.id))
      .each(thread => {
        if (!threadsByUser.has(thread.author.name)) {
          threadsByUser.set(thread.author.name, []);
        }
      }).mapSeries(thread => {
        const oldThread = threadsByUser.get(thread.author.name).find(oldThread => threadBreaksRules(thread, oldThread));

        if (oldThread && thread.approved_by === null) {
          return thread.remove().lock().reply(getSpamReply(thread, oldThread)).distinguish().return(
            `[Flood notification]: The thread <${thread.url}> by /u/${thread.author.name} breaks the flood rule, and has been removed. (Old thread: <${oldThread.url}> )`
          ).tap(() => usernoteHelper.addNote({mod: nick, user: thread.author.name, subreddit: thread.subreddit.display_name, note: '6 hour rule', link: `l,${thread.id}`, index: 0, fromChannel: null}));
        } else {
          threadsByUser.set(
            thread.author.name,
            threadsByUser.get(thread.author.name)
              .filter(oldThread => oldThread.created_utc + SPAM_COOLDOWN > Date.now() / 1000)
              .concat({url: thread.url, created_utc: thread.created_utc, link_flair_text: thread.link_flair_text})
          );
        }
      }).filter(response => response);
  }
};

function threadBreaksRules (thread, oldThread) {
  return oldThread.created_utc + SPAM_COOLDOWN > thread.created_utc && (
    TRADE_TYPE_FLAIRS.has(thread.link_flair_text) && TRADE_TYPE_FLAIRS.has(oldThread.link_flair_text) ||
    GIVEAWAY_TYPE_FLAIRS.has(thread.link_flair_text) && GIVEAWAY_TYPE_FLAIRS.has(oldThread.link_flair_text)
  );
}
