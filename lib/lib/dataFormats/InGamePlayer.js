"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInGamePlayer = void 0;
const types_1 = require("../logics/game/types");
var Suit;
(function (Suit) {
    Suit["Heart"] = "Heart";
    Suit["Club"] = "Club";
    Suit["Spade"] = "Spade";
    Suit["Diamond"] = "Diamond";
})(Suit || (Suit = {}));
function createInGamePlayer(playerData, tableMaxBuyIn, fullPlayerData) {
    let newPlayer = {
        playerId: playerData.playerId,
        tableId: playerData.tableId,
        chips: Math.trunc(playerData.chips),
        seatIndex: playerData.seatIndex,
        playerName: playerData.playerName,
        networkIp: playerData.networkIp,
        deviceType: playerData.deviceType,
        instantBonusAmount: Math.trunc(playerData.instantBonusAmount) || 0,
        avatar: fullPlayerData.info.avatar,
        state: playerData.state || types_1.PlayerState.Waiting,
        onGameStartBuyIn: Math.trunc(playerData.chips),
        onSitBuyIn: Math.trunc(playerData.chips),
        isAutoReBuy: playerData.isAutoReBuy || false,
        playerPlaySession: Date.now(),
        playerPlaySessionExceeded: false,
        playerDealtInLastRound: false,
        showContinueBetPopUp: false,
        previouslyPopUpShowed: false,
        totalBetOnTable: 0,
        chipsIn: Math.trunc(fullPlayerData.accountInfo.realChips),
        playerGame_timeOut_min: fullPlayerData.loginInfo.game_timeout_min,
        active: false,
        lastBet: 0,
        sideBet: 0,
        totalRoundBet: 0,
        totalGameBet: 0,
        autoReBuyAmount: 0,
        isPlayed: false,
        chipsToBeAdded: 0,
        turnTime: Date.now(),
        hasPlayedOnceOnTable: false,
        insuranceActionTaken: false,
        isWaitingPlayer: true,
        disconnectedMissed: 0,
        sitoutGameMissed: 0,
        isInsuranceAsked: false,
        isDisconnected: false,
        isRunItTwice: false,
        totalGames: 0,
        stats: fullPlayerData.statistics,
        leavePossible: false,
        initialBet: 0,
        handInfo: {
            left: {
                cards: [],
                handValue: {
                    hi: 0,
                    lo: 0
                },
                hasBusted: false,
                hasBlackjack: false,
                close: false,
                initialBet: 0,
                availableActions: {
                    double: false,
                    split: false,
                    insurance: false,
                    hit: false,
                    stand: false,
                    surrender: false
                }
            },
            right: {
                cards: [],
                handValue: {
                    hi: 0,
                    lo: 0
                },
                hasBusted: false,
                hasBlackjack: false,
                close: false,
                initialBet: 0,
                availableActions: {
                    double: false,
                    split: false,
                    insurance: false,
                    hit: false,
                    stand: false,
                    surrender: false
                }
            }
        },
        hasBlackJack: false,
        hasPlacedInsurance: false,
        history: [],
        roundId: "",
        settings: fullPlayerData.preferences
    };
    return newPlayer;
}
exports.createInGamePlayer = createInGamePlayer;
