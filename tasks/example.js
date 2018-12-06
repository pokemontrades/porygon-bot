// States the current time and the uptime each minute. This is very irritating in practice and enabling it is not recommended.
'use strict';
const Discord = require('discord.js');
const config = require('../config.js');

let counter = 0;
module.exports = {
  period: 60,
  onStart: true,
  task () {
    counter++;
    const embedColor = config.discord.embedColor[Math.floor(Math.random()*config.discord.embedColor.length)];
    const embed = new Discord.RichEmbed()
    .setColor(embedColor)
    .setDescription(`The time is now ${new Date().toTimeString()}. This bot was last restarted ${counter} minutes ago.`)
    return {
      text: `The time is now ${new Date().toTimeString()}. This bot was last restarted ${counter} minutes ago.`,
      richText: embed
    }
  }
};
