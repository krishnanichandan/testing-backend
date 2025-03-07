"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchPlayerBetContinuePhaseBroadcast = exports.dispatchPlayerPlaySessionBroadCast = exports.dispatchPlayerSurrenderBroadcast = exports.dispatchGameOverBroadcast = exports.dispatchDealerHoldcardBroadCasts = exports.dispatchPlayerInsuranceBroadCasts = exports.dispatchStartBettingBroadCasts = exports.dispatchInsuranceBroadCasts = exports.dispatchLeaveBroadcast = exports.dispatchPlayerDealBroadCast = exports.dispatchPlayerChipsBroadCast = exports.dispatchStartGameBroadcast = exports.dispatchDistributeCardsBroadcast = exports.dispatchPlayerStateBroadcast = exports.dispatchTablePlayersBroadcast = exports.dispatchPlayerSitBroadcast = exports.dispatchOnTurnBroadcast = void 0;
const underscore_1 = require("underscore");
const ResponseMaker_1 = require("../../dataFormats/ClientDataFormat.ts/ResponseMaker");
function dispatchOnTurnBroadcast(room, data) {
    let dataToSend = {
        isGameOver: data.isGameOver,
        turn: data.turn
    };
    console.log("****OnTurnBroadCast***->", JSON.stringify(dataToSend));
    room.broadcast("OnTurn", dataToSend);
}
exports.dispatchOnTurnBroadcast = dispatchOnTurnBroadcast;
function dispatchPlayerSitBroadcast(room, player) {
    let data = {
        tableId: player.tableId, playerId: player.playerId, chips: player.chips, seatIndex: player.seatIndex, playerName: player.playerName, avatar: player.avatar, state: player.state,
        statistics: player.stats
    };
    console.log("sit broadcast->", data);
    room === null || room === void 0 ? void 0 : room.broadcast("PlayerSit", data);
}
exports.dispatchPlayerSitBroadcast = dispatchPlayerSitBroadcast;
function dispatchTablePlayersBroadcast(room, data) {
    //todos slice player data in everybroadcast and able data etc.
    room.broadcast("TablePlayers", data);
}
exports.dispatchTablePlayersBroadcast = dispatchTablePlayersBroadcast;
function dispatchPlayerStateBroadcast(room, data) {
    room.broadcast("PlayerState", data);
}
exports.dispatchPlayerStateBroadcast = dispatchPlayerStateBroadcast;
function dispatchDistributeCardsBroadcast(room, data) {
    let ts = JSON.parse(JSON.stringify((0, underscore_1.map)(data.players, function (player) { return (0, underscore_1.pick)(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "handInfo", "history"); })));
    room.broadcast("DistributeCards", { tableId: data.tableId, players: ts, numCards: data.numCards, dealer: data.dealer });
}
exports.dispatchDistributeCardsBroadcast = dispatchDistributeCardsBroadcast;
// ### Broadcast start game on table ALSO start a video json record
// > Inform client to start a game on table and provide details
// > Get current config for table
// > channelId, currentPlayerId, smallBlindId, bigBlindId, dealerId, straddleId, bigBlind, smallBlind, pot, roundMaxBet, state, playerCards
function dispatchStartGameBroadcast(room, table) {
    var tdata = (0, ResponseMaker_1.gameStartBroadcastData)(table);
    tdata.config.currentMoveIndex = undefined;
    room.broadcast("StartGame", tdata);
    return tdata;
}
exports.dispatchStartGameBroadcast = dispatchStartGameBroadcast;
;
function dispatchPlayerChipsBroadCast(room, data) {
    room.broadcast("PlayerGameChips", data);
}
exports.dispatchPlayerChipsBroadCast = dispatchPlayerChipsBroadCast;
function dispatchPlayerDealBroadCast(room, data) {
    room.broadcast("PlayerDeal", data);
}
exports.dispatchPlayerDealBroadCast = dispatchPlayerDealBroadCast;
;
function dispatchLeaveBroadcast(room, data) {
    console.log("leave BroadCast->", JSON.stringify(data));
    room.broadcast("OnPlayerLeft", data);
}
exports.dispatchLeaveBroadcast = dispatchLeaveBroadcast;
;
function dispatchInsuranceBroadCasts(room, data) {
    room.broadcast("StartInsurance", data);
}
exports.dispatchInsuranceBroadCasts = dispatchInsuranceBroadCasts;
;
function dispatchStartBettingBroadCasts(room, data) {
    const bettingPlayers = [];
    data.bettingPlayers.forEach((player) => {
        const data = {
            seatIndex: player.seatIndex,
            initialBet: player.initialBet,
            turnTime: player.turnTime,
            playerId: player.playerId,
            tableId: player.tableId,
            playerName: player.playerName,
            active: player.active,
            chips: player.chips,
            avatar: player.avatar,
            state: player.state,
            isWaitingPlayer: player.isWaitingPlayer,
        };
        bettingPlayers.push(data);
    });
    data.bettingPlayers = bettingPlayers;
    room.broadcast("StartBettingPhase", data);
}
exports.dispatchStartBettingBroadCasts = dispatchStartBettingBroadCasts;
;
function dispatchPlayerInsuranceBroadCasts(room, data) {
    room.broadcast("playerInsurance", data);
}
exports.dispatchPlayerInsuranceBroadCasts = dispatchPlayerInsuranceBroadCasts;
;
function dispatchDealerHoldcardBroadCasts(room, data) {
    room.broadcast("dealerHoldCardOpen", data);
}
exports.dispatchDealerHoldcardBroadCasts = dispatchDealerHoldcardBroadCasts;
;
function dispatchGameOverBroadcast(room, data) {
    console.log("**OnGameOver Broadcast->", JSON.stringify(data));
    room.broadcast("OnGameOver", data);
}
exports.dispatchGameOverBroadcast = dispatchGameOverBroadcast;
;
function dispatchPlayerSurrenderBroadcast(room, data) {
    room.broadcast("OnPlayerSurrender", data);
}
exports.dispatchPlayerSurrenderBroadcast = dispatchPlayerSurrenderBroadcast;
function dispatchPlayerPlaySessionBroadCast(room, data) {
    room.broadcast("OnPlayerSessionOver", data);
}
exports.dispatchPlayerPlaySessionBroadCast = dispatchPlayerPlaySessionBroadCast;
function dispatchPlayerBetContinuePhaseBroadcast(room, data) {
    room.broadcast("OnPlayerContinueBetPhase", data);
}
exports.dispatchPlayerBetContinuePhaseBroadcast = dispatchPlayerBetContinuePhaseBroadcast;
