"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.senitizeNextTurnData = exports.gameStartBroadcastData = exports.tableJoinResponseData = void 0;
const types_1 = require("../../logics/game/types");
const gameConstants_1 = require("../../logics/game/gameConstants");
const SchedulerHelper_1 = require("../../logics/game/SchedulerHelper");
const underscore_1 = require("underscore");
function tableJoinResponseData(table, playerId, data) {
    let res = {};
    // res.success = true;
    res.tableDetails = {};
    // res.roomConfig = {};
    let playerIndex = table.currentInfo.players.findIndex((player) => player.playerId === playerId);
    if (table.currentInfo.state === types_1.GameState.Betting) {
        table.info.turnTime = 8;
    }
    else {
        table.info.turnTime = 10;
    }
    res.tableDetails = {
        tableId: table.id,
        isSinglePlayerTable: table.info.isSinglePlayerTable || false,
        dealer: table.currentInfo.dealer,
        tableName: table.info.name,
        minBuyIn: table.info.minBuyIn,
        maxBuyIn: table.info.maxBuyIn,
        info: "string to show", //table.info.
        turnTime: table.info.turnTime,
        state: table.currentInfo.state,
        roundCount: table.currentInfo.roundCount,
        roundNumber: table.currentInfo.roundNumber,
        maxBetAllowed: table.info.maxBetAllowed,
        dealerIndex: table.currentInfo.dealerSeatIndex,
        currentMoveIndex: table.currentInfo.currentMoveIndex >= 0 && !!table.currentInfo.players[table.currentInfo.currentMoveIndex] ? table.currentInfo.players[table.currentInfo.currentMoveIndex].seatIndex : -1,
        isRealMoney: table.info.isRealMoney,
        currentPlayingPosition: table.currentInfo.currentPlayingPosition || 'right',
        game_text1: table.info.game_text1 || "",
        game_text2: table.info.game_text2 || "",
        game_text3: table.info.game_text3 || ""
    };
    let numCards = 2;
    if (table.currentInfo.state === types_1.GameState.Running && table.currentInfo.currentMoveIndex >= 0) {
    }
    else {
    }
    res.selfPlayerDetails = {
        playerId: playerId, //nn
        isJoinWaiting: false,
        settings: data.settings || { muteGameSound: true, dealerChat: false, playerChat: false, tableColor: 0, backFaceCard: 0, frontFaceCard: 0 }
    };
    let timeLapsed = Math.trunc((((new Date().getTime()) - (table.currentInfo.turnTimeStartAt)) / 1000));
    res.tableDetails.remainingMoveTime = table.currentInfo.state === types_1.GameState.Running || table.currentInfo.state === types_1.GameState.Betting ? ((Math.trunc(table.info.turnTime) - Math.trunc(timeLapsed)) < 0 ? 0 : (Math.trunc(table.info.turnTime) - Math.trunc(timeLapsed))) : 0;
    var detTimeAllowed = (table.currentInfo.state == types_1.GameState.Running && table.currentInfo.currentMoveIndex >= 0 && table.currentInfo.players[table.currentInfo.currentMoveIndex].state === types_1.PlayerState.Disconnected);
    if (!detTimeAllowed) {
        detTimeAllowed = table.currentInfo.state === types_1.GameState.Running && table.currentInfo.currentMoveIndex >= 0 && (table.currentInfo.players[table.currentInfo.currentMoveIndex].playerId === playerId && data.previousState === types_1.PlayerState.Disconnected);
    }
    let isConnectedCheckTime = 2;
    if (detTimeAllowed) {
        if ((timeLapsed) > Math.trunc(table.info.turnTime)) {
            res.tableDetails.remainingMoveTime = Math.trunc(res.tableDetails.extraTurnTime) + Math.trunc(table.info.turnTime) + isConnectedCheckTime - Math.trunc(timeLapsed);
            res.tableDetails.additionalTurnTime = res.tableDetails.extraTurnTime; // -  systemConfig.isConnectedCheckTime;
        }
        else {
            res.tableDetails.remainingMoveTime = Math.trunc(table.info.turnTime) - Math.trunc(timeLapsed);
            res.tableDetails.additionalTurnTime = Math.trunc(table.info.turnTime);
        }
    }
    if (res.tableDetails.remainingMoveTime < 0) {
        res.tableDetails.remainingMoveTime = Math.trunc(table.info.turnTime) + Math.trunc(res.tableDetails.extraTurnTime) + isConnectedCheckTime - Math.trunc(timeLapsed);
        res.tableDetails.additionalTurnTime = res.tableDetails.extraTurnTime;
    }
    res.players = [];
    table.currentInfo.players.forEach((player) => {
        var _a;
        let insurance = player.history && player.history.length ? player.history.filter((x) => x.type === gameConstants_1.PlayerMove.Insurance) : null;
        let isInsurancePlayed = player.history && player.history.length ? player.history.some((x) => x.type === gameConstants_1.PlayerMove.Insurance) : null;
        let insuranceReaction = false;
        let insuranceAmount = 0;
        let isCurrentPlayer = (table.currentInfo.currentMoveIndex != -1 && table.currentInfo.players[table.currentInfo.currentMoveIndex] && ((_a = table.currentInfo.players[table.currentInfo.currentMoveIndex]) === null || _a === void 0 ? void 0 : _a.seatIndex) === player.seatIndex) ? true : false;
        if (insurance) {
            insuranceReaction = insurance && insurance.length ? insurance[0].isInurancePlace : false;
            insuranceAmount = insurance && insurance.length ? insurance[0].amount : 0;
        }
        let p = {
            tableId: player.tableId,
            playerId: player.playerId,
            playerName: player.playerName,
            chips: player.chips,
            seatIndex: player.seatIndex,
            handInfo: player.handInfo,
            history: player.history,
            state: player.state,
            previousState: player.previousState || '',
            isPartOfGame: ((table.currentInfo.state === types_1.GameState.Running || table.currentInfo.state === types_1.GameState.Betting) && table.currentInfo.roundId === player.roundId),
            imageAvtar: player.avatar,
            turnTime: res.tableDetails.remainingMoveTime,
            hasPlacedInsurance: player.hasPlacedInsurance,
            isInsuranceAsked: player.isInsuranceAsked,
            totalRoundBet: player.totalRoundBet,
            showInsuranceTime: table.currentInfo.state === types_1.GameState.Running && player.isInsuranceAsked ? (isInsurancePlayed ? false : true) : false, //(player.hasPlacedInsurance ? false : insuranceReaction) : false,
            showBettingTime: table.currentInfo.state === types_1.GameState.Betting && player.state === types_1.PlayerState.Betting,
            showCurrentMoveTime: isCurrentPlayer,
            sideBet: insuranceAmount,
            initialBet: player.initialBet,
            isWaitingPlayer: player.isWaitingPlayer,
            active: player.active,
            statistics: player.stats
        };
        res.players.push(p);
    });
    res.showDifferentPopDetails = {
        OnPlayerContinueBetPhase: SchedulerHelper_1.SchedulerHelper.Instance.isJobScheduledForBetPhase(table.id, playerId),
        OnPlayerSessionOver: SchedulerHelper_1.SchedulerHelper.Instance.isJobScheduledForRemovePlayerSessionPopUp(table.id, playerId)
    };
    return res;
}
exports.tableJoinResponseData = tableJoinResponseData;
// Generate response for Game start broadcast
function gameStartBroadcastData(table) {
    let res = {};
    res.success = true;
    res.config = {
        tableId: table.id,
        minBet: table.info.minBuyIn,
        maxBet: table.info.maxBuyIn,
        roundNumber: table.currentInfo.roundNumber,
        dealerIndex: table.currentInfo.dealerSeatIndex,
        players: table.currentInfo.players, //
        state: table.currentInfo.state,
    };
    res.eventDetails = {
        playingPlayers: (0, underscore_1.where)(table.currentInfo.players, { state: types_1.PlayerState.Playing }),
        tableDetails: {
            isRealMoney: table.info.isRealMoney,
            tableName: table.info.name,
            dealerSeatIndex: table.currentInfo.dealerSeatIndex
        }
    };
    delete res.eventDetails;
    res.removed = [];
    return res;
}
exports.gameStartBroadcastData = gameStartBroadcastData;
;
function senitizeNextTurnData() { }
exports.senitizeNextTurnData = senitizeNextTurnData;
;
