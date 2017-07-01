'use strict';

const tls = require('tls');
const Promise = require('bluebird');
const moment = require('moment');

const SITES = ['porybox.com', 'hq.porygon.co', 'modapps.porygon.co'];

module.exports = {
  period: 60 * 60 * 24,
  concurrent: true,
  task () {
    return Promise.reduce(SITES, (messages, host) => {
      return getSecureSocket(host).then(socket => {
        if (!socket.authorized) {
          return messages.concat(`Warning: The site ${host} has an invalid SSL certificate. SSL error: ${socket.authorizationError}`);
        }
        const expirationTime = moment.utc(socket.getPeerCertificate().valid_to, 'MMM D HH:mm:ss YYYY');
        if (expirationTime < moment().add({days: 14})) {
          return messages.concat(`Warning: The SSL certificate for ${host} expires ${expirationTime.fromNow()}`);
        }
        return messages;
      });
    }, []);
  }
};

function getSecureSocket(host) {
  return new Promise(resolve => {
    const socket = tls.connect({host, port: 443, rejectUnauthorized: false}, () => resolve(socket));
  });
}
