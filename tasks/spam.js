const r = require('../services/reddit');
const SUBREDDIT = 'pokemontrades';

const SPAM_COOLDOWN = 60 * 60 * 6; // The number of seconds allowed between threads
const TRADE_TYPE_CSS_CLASSES = new Set(['event', 'shiny', 'comp', 'casual', 'item', 'tradeback', 'dexevo', 'file', 'redeem', 'bank']);
const GIVEAWAY_TYPE_CSS_CLASSES = new Set(['contest', 'giveaway']);

const threadsByUser = new Map();
const handledThreadIds = new Set();

module.exports = {
  period: 60,
  task () {
    return r.getSubreddit(SUBREDDIT).getNew().filter(thread => !handledThreadIds.has(thread.id)).each(thread => {
      if (!threadsByUser.has(thread.author.name)) {
        threadsByUser.set(thread.author.name, []);
      }
      threadsByUser.set(
        thread.author.name,
        threadsByUser.get(thread.author.name)
          .filter(oldThread => oldThread.created_utc + SPAM_COOLDOWN > Date.now() / 1000)
          .concat({url: thread.url, created_utc: thread.created_utc, link_flair_css_class: thread.link_flair_css_class})
      );
      handledThreadIds.add(thread.id);
    }).filter(thread => {
      return threadsByUser.get(thread.author.name).slice(0, -1).some(oldThread => threadBreaksRules(thread, oldThread));
    }).map(spamThread => {
      return [
        `[Spam notification]: The thread ${spamThread.url} by /u/${spamThread.author.name} breaks the spam rule.`,
        `Previous thread: ${threadsByUser.get(spamThread.author.name).find(oldThread => threadBreaksRules(spamThread, oldThread)).url}`
      ].join(' ');
    });
  }
};

function threadBreaksRules (thread, oldThread) {
  return oldThread.created_utc + SPAM_COOLDOWN > thread.created_utc && (
    TRADE_TYPE_CSS_CLASSES.has(thread.link_flair_css_class) && TRADE_TYPE_CSS_CLASSES.has(oldThread.link_flair_css_class) ||
    GIVEAWAY_TYPE_CSS_CLASSES.has(thread.link_flair_css_class) && GIVEAWAY_TYPE_CSS_CLASSES.has(oldThread.link_flair_css_class)
  );
}
