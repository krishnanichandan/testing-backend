"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.popCard = exports.totalActiveBettingPlayers = exports.totalActivePlayers = exports.getPlayersByState = void 0;
const underscore_1 = require("underscore");
const types_1 = require("../types");
function getPlayersByState(table, state) {
    return (0, underscore_1.where)(table.currentInfo.players, { state: state });
}
exports.getPlayersByState = getPlayersByState;
function totalActivePlayers(input) {
    let players = (0, underscore_1.filter)(input.table.currentInfo.players, function (p) {
        return ((p.state == types_1.PlayerState.Playing || p.state == types_1.PlayerState.Disconnected) && p.active == true && p.initialBet > 0);
    });
    return ({ success: true, players: players });
}
exports.totalActivePlayers = totalActivePlayers;
function totalActiveBettingPlayers(input) {
    let players = (0, underscore_1.filter)(input.table.currentInfo.players, function (p) {
        return ((p.state == types_1.PlayerState.Betting || p.state == types_1.PlayerState.Disconnected) && p.active == true);
    });
    return ({ success: true, players: players });
}
exports.totalActiveBettingPlayers = totalActiveBettingPlayers;
function popCard(table, count) {
    let cards = table.currentInfo.deck.slice(0, count);
    table.currentInfo.deck.splice(0, count);
    return ({ success: true, cards: cards });
}
exports.popCard = popCard;
;
