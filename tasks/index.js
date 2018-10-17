'use strict';
const _ = require('lodash');
const taskNames = require('fs').readdirSync(`${__dirname}/`)
  .filter(name => /\.js$/.test(name) && name !== 'index.js')
  .map(name => name.replace(/\.js$/, ''));
module.exports = _.mapValues(_.zipObject(taskNames, taskNames.map(name => require(`./${name}`)).filter(module => module !== undefined)), task => _.defaults(task, {
  onStart: false,
  concurrent: false,
  task: _.noop
}));
