// States the current time and the uptime each minute. This is very irritating in practice and enabling it is not recommended.
'use strict';
let counter = 0;
module.exports = {
  period: 60000,
  onStart: true,
  task () {
    return `The time is now ${new Date().toTimeString()}. This bot was last restarted ${counter++} minutes ago.`;
  }
};
