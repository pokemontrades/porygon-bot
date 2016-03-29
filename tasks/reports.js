'use strict';
const r = require('../services/reddit');
let reportedItemNames = new Set();
let hasFinishedFirstRun = false;

const SUBREDDITS = ['pokemontrades', 'SVExchange'];

module.exports = {
  period: 60,
  onStart: true,
  task () {
    return r.get_subreddit(SUBREDDITS.join('+')).get_reports({limit: 25}).then(items => {
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
  const permalink = item.constructor.name === 'Comment' ? item.link_url + item.id : item.url;
  return `[New report] ${item.constructor.name} by /u/${item.author.name}: ${permalink}`;
}
