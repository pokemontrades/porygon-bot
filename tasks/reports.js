'use strict';
const r = require('../services/reddit');
let reportedItemNames = new Set();
let hasFinishedFirstRun = false;

const SUBREDDITS = ['pokemontrades', 'SVExchange'];

module.exports = {
  period: 60,
  onStart: true,
  task () {
    return r.get_subreddit(SUBREDDITS.join('+')).get_reports({limit: hasFinishedFirstRun ? 25 : 50}).then(items => {
      // Don't output the new reports on the first fetch, as that would cause old reports to be listed.
      // Unfortunately, there is no way to tell whether reports on an item have been ignored using the OAuth API.
      const newItemsToReport = hasFinishedFirstRun ? items.filter(item => !reportedItemNames.has(item.name)) : [];
      items.forEach(item => reportedItemNames.add(item.name));
      hasFinishedFirstRun = true;
      return newItemsToReport.map(formatItem);
    });
  }
};

function formatItem (item) {
  const permalink = item.constructor.name === 'Submission' ? `https://redd.it/${item.id}` : `https://reddit.com/r/${item.subreddit.display_name}/comments/${item.link_id.slice(3)}/-/${item.id}`;
  const reportReason = item.user_reports.length ? item.user_reports[0][0] : item.mod_reports.length ? item.mod_reports[0][0] : '';
  return `[New report]: "${reportReason}" (on ${item.constructor.name.toLowerCase()} by /u/${item.author.name}, ${permalink} )`;
}
