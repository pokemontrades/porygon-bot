'use strict';
var _ = require('lodash');
var ball_data = require('../ball_data.json');
var pokemon_list = _.keys(ball_data.legal);
for (let i = 0; i < pokemon_list.length; i++) {
  var parsed = [];
  for (let j = 0; j < ball_data.ball_types.length; j++) {
    var data = parseInt(ball_data.legal[pokemon_list[i]].charAt(j), 8);
    parsed.push({ball_name: ball_data.ball_types[j], legal: !!(data & 4), ha: !!(data & 2), breedable: !!(data & 1)});
  }
  ball_data.legal[pokemon_list[i]] = parsed;
}
var pokemon_corrections = {'nidoran-m': 'nidoran♂', 'nidoran-f': 'nidoran♀', 'nidoran': 'nidoran♀'};
var ball_corrections = {'poké': 'poke'};
for (let i in ball_data.apricorn) {
  ball_corrections[ball_data.apricorn[i]] = 'apricorn';
}
function formatted_ball_name (ball_name) {
  return ball_name.toLowerCase() === 'poke' ? 'Poké' : _.capitalize(ball_name.toLowerCase());
}

module.exports = {
  message_regex: /^.checkball ([^ ]+)(?: ([^ ]+))?/i,
  response: function (message_match) {
    let pokemon = pokemon_corrections[message_match[1].toLowerCase()] || message_match[1].toLowerCase();
    var pokemon_data = ball_data.legal[pokemon];
    if (!pokemon_data) {
      throw {error_message: "No Pokémon data found for '" + message_match[1] + "'."};
    }
    if (message_match[2]) {
      var ball = _.find(pokemon_data, {ball_name: ball_corrections[message_match[2].toLowerCase()] || message_match[2].toLowerCase()});
      if (!ball) {
        throw {error_message: "No ball data found for '" + message_match[2] + "'"};
      }
      return formatted_ball_name(message_match[2]) + ' Ball ' + _.capitalize(pokemon) + ' - Legal? ' + (ball.legal ? ('YES' + (ball.ha ? '' : ' (HA illegal)') + (ball.breedable ? '' : ' (Cannot be bred)')) : 'NO');
    }
    var released_ha = _.findIndex(pokemon_data, {legal: true, ha: true}) !== -1;
    var ha_star_needed = released_ha && _.findIndex(pokemon_data, {legal: true, ha: false}) !== -1;
    var breedable_balls = _.filter(pokemon_data, {legal: true, breedable: true});
    return 'Legal balls for ' + _.capitalize(pokemon) + ': ' + _.filter(pokemon_data, {legal: true}).map(function (ball) {
      return formatted_ball_name(ball.ball_name) + (!ball.ha && ha_star_needed ? '*' : '') + (breedable_balls.length > 1 && !ball.breedable ? ' (Cannot be bred)' : '');
    }).join(', ') + (!released_ha ? ' (HA illegal in all balls)' : ha_star_needed ? ' (* = HA illegal)' : '') + (breedable_balls.length === 1 ? ' (Can only be bred in Poké Ball)' : !breedable_balls.length ? ' (Cannot be bred in any ball)' : '');
  }
};
