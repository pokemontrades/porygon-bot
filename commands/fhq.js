'use strict';
const Discord = require('discord.js');
const config = require('../config.js');

module.exports = {
  message_regex: /^\.fhq(?: (?:\/u\/)?([\w-]+))?/,
  response: ({ message_match: [, username] }) => `https://hq.porygon.co${username ? `/u/${username}` : ''}`,
  richResponse: ({ message_match: [, username] }) => {
    const embedColor = config.discord.embedColor[Math.floor(Math.random()*config.discord.embedColor.length)];
    const embed = new Discord.RichEmbed()
    .setTitle(`/u/${username} Flair HQ`, 'https://hq.porygon.co/images/fhq-500.png')
    .setURL(`https://hq.porygon.co/u/${username}`)
    .setColor(embedColor)
    
return embed;
  }
};
