"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processGameOver = void 0;
const engine = __importStar(require("../game/engine"));
const types_1 = require("./types");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const gameConstants_1 = require("./gameConstants");
const WinnerUtils_1 = require("./WinnerUtils");
const chipsManagement_1 = require("./chipsManagement");
function isGameInProgress(input) {
    if (input.processedData.table.currentInfo.state === types_1.GameState.Over) {
        return ({ success: true, winners: input.processedData.data.winners, lossers: input.processedData.data.lossers, endingType: input.processedData.data.endingType, data: input.processedData.data });
    }
    else {
        return ({ success: false, tableId: (input.processedData.table.id || ""), info: "The present hand is over. Please remain part of game." });
    }
}
;
function processGameOver(input) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info('processGameOver started', { input: input });
        input.processedData.data = input.processedData.data || {};
        let arr = [initData, decideTableWinnerAndLossers, awardWinningChipsToWinners, rewardVipPoints, checkNeedToShuffleCardInNextGame, resetDealerOnGameOver, resetPlayersOnGameOver,
            resetTableOnGameOver, createGameOverResponse];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let res = yield pipeline.run(input).catch(e => {
            console.log("exception at process game over", e);
        });
        if (!!res) {
            return { success: true, data: input.processedData.data };
        }
        else {
            return { success: false, info: "some error in processing game over" };
        }
    });
}
exports.processGameOver = processGameOver;
let initData = new j_stillery_1.Task((input, resolve, reject) => {
    let isGameProgressResponse = isGameInProgress(input);
    if (isGameProgressResponse.success) {
        let data = input.processedData.data;
        data.decisionParams = [];
        data.winners = [];
        data.lossers = [];
        data.playersResult = [];
        data.endingType = types_1.EndingType.GameComplete;
        data.rakeDeducted = 0;
        data.rewardDistributed = false;
        data.rakeShouldDeduct = false;
        data.dealerHoldCardDistributeBroadCast = false;
        data.rakeDistributionResult = {
            totalRakeGenerated: 0,
            superAdmin: 0,
            admin: 0,
            affiliate: 0,
            playerRb: 0,
            gst: 0
        };
        resolve(input);
    }
    else {
        input.processedData.data.rakeDistributionResult = {
            totalRakeGenerated: 0,
            superAdmin: 0,
            admin: 0,
            affiliate: 0,
            playerRb: 0,
            gst: 0
        };
        input.processedData.errorData = isGameProgressResponse;
        reject(input);
    }
});
let decideTableWinnerAndLossers = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let pwdResponse = yield processWinnerAndLosserDecision(input, input.processedData.table);
    input.processedData.data.playersResult = pwdResponse.result;
    resolve(input);
}));
let awardWinningChipsToWinners = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = {
        table: input.processedData.table,
        data: input.processedData.data
    };
    yield (0, WinnerUtils_1.awardWinningChips)(payload);
    resolve(input);
}));
let rewardVipPoints = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    resolve(input);
}));
let checkNeedToShuffleCardInNextGame = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    //check for do we need to shuffle cards in next game
    resolve(input);
}));
let resetDealerOnGameOver = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    let dealer = table.currentInfo.dealer;
    dealer.hand = [];
    dealer.holdCard = null;
    dealer.isHoldCardOpened = false;
    dealer.totalPoints = { hi: 0, lo: 0 };
    dealer.isSoft17 = false;
    dealer.isBusted = false;
    dealer.hasBlackjack = false;
    dealer.isVisible = false;
    table.currentInfo.dealer = dealer;
    resolve(input);
}));
// ### Reset players attributes on game over
let resetPlayersOnGameOver = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    let playerAfter = null;
    //dont use async in for each - use for of
    table.currentInfo.players.forEach((player) => __awaiter(void 0, void 0, void 0, function* () {
        setPlayerState(input, player);
        player.chips = Math.trunc(player.chips); //+ (!!player.tournamentData && !!player.tournamentData.rebuyChips ? player.tournamentData.rebuyChips : 0);
        player.initialBet = 0;
        player.history = [];
        player.handInfo = {
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
        };
        player.roundId = '';
        var chipsAddedActually = 0;
        var playerOldChips = player.chips;
        // Add chips on player table amount if only amount to be added exists
        if (Math.trunc(player.chipsToBeAdded) > 0) { // If player have some chips to add for next game
            if (player.chips + player.chipsToBeAdded >= table.info.maxBuyIn && player.chips < table.info.maxBuyIn) { // If player additional chips crossed maxbuyin then set player chips as maxbuyin
                chipsAddedActually = table.info.maxBuyIn - player.chips;
                player.chips = Math.trunc(table.info.maxBuyIn);
                // Update onsitbuyin for this player (adding here after addchips feature update)
                // Update only if chips are changing due to adding additional chips on player's ontable amount
                player.onSitBuyIn = player.chips;
            }
            else if (player.chips + player.chipsToBeAdded <= table.info.maxBuyIn && player.chips + player.chipsToBeAdded >= table.info.minBuyIn) { // If player chips will become inside min-max buyin range then add all additional chips
                chipsAddedActually = Math.trunc(player.chipsToBeAdded);
                player.chips = Math.trunc(player.chips) + Math.trunc(player.chipsToBeAdded);
                // Update onsitbuyin for this player (adding here after addchips feature update)
                // Update only if chips are changing due to adding additional chips on player's ontable amount
                player.onSitBuyIn = player.chips;
            }
            else { // If player total chips will become less than minbuyin then do not add any chips
                chipsAddedActually = 0;
                //.info, 'Not adding chips for ' + player.playerName + ', as it will not match min-max buyin range of table.');
            }
        }
        else {
            //.info, 'No additional chips is going to be added for ' + player.playerName + '.');
        }
        // Reset player state if chips are greater than 0 and state if OUTOFMONEY
        if (Math.trunc(player.chips) > 0 && player.state === types_1.PlayerState.OutOfMoney) {
            player.state = types_1.PlayerState.Waiting;
        }
        // THIS LINE ADDED TO CHANGE DISCONNECTED PLAYER STAE TO SITOUT STATE NEW CODE START
        if (player.state === types_1.PlayerState.Disconnected) {
            player.state = types_1.PlayerState.Waiting;
        }
        // NEW CODE END
        player.isPlayed = false;
        player.active = true;
        // player.lastMove = null;
        player.lastBet = 0;
        player.chipsToBeAdded = 0;
        player.totalRoundBet = 0;
        player.totalGameBet = 0;
        // player.tournamentData.rebuyChips = 0;
        if (chipsAddedActually > 0) {
            let payload = { playerId: player.playerId, isRealMoney: table.info.isRealMoney, chips: Math.trunc(chipsAddedActually), tableId: table.id, subCategory: "Add Chips", tableName: table.info.name };
            let deductChipsResponse = yield (0, chipsManagement_1.deductChips)(payload);
            if (deductChipsResponse.success) {
                // console.trace("on gameover chips deduct success--" + JSON.stringify(deductChipsResponse));
                player.instantBonusAmount = player.instantBonusAmount + deductChipsResponse.instantBonusAmount;
                input.processedData.data.chipsBroadcast = input.processedData.data.chipsBroadcast || [];
                input.processedData.data.chipsBroadcast.push(player.playerId);
                player.activityRecord.totalChipsAdded += Math.trunc(chipsAddedActually);
            }
            else {
                player.chips = playerOldChips;
                player.onSitBuyIn = player.chips;
                // player.onGameStartBuyIn = player.chips; // Reset on game start buyin //// Reset on game start buyin //commenting for using it in handhistory helper to calculate lossamount
                if (Math.trunc(player.chips) <= 0) {
                    player.state = types_1.PlayerState.OutOfMoney;
                }
                if (Math.trunc(player.chips) > 0 && player.state === types_1.PlayerState.OutOfMoney) {
                    player.state = types_1.PlayerState.Waiting;
                }
                input.processedData.data.addChipsFailed = input.processedData.data.addChipsFailed || [];
                input.processedData.data.addChipsFailed.push(player.playerId);
                // ecb(deductChipsResponse);
            }
        }
        else {
        }
    }));
    resolve(input);
}));
// ### Reset table values on game over
let resetTableOnGameOver = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    table.currentInfo.state = types_1.GameState.Idle;
    table.currentInfo.stateInternal = types_1.GameState.Idle;
    table.currentInfo.roundCount = table.currentInfo.roundCount + 1;
    table.info.maxBetAllowed = 0; //not used really anywhere much
    table.currentInfo.isOperationOn = false;
    table.currentInfo.isBettingRoundLocked = false;
    table.currentInfo.currentMoveIndex = -1;
    table.currentInfo.isInsuranceAsked = false;
    table.currentInfo.isInsurancePlacedOnTable = false;
    table.currentInfo.maxBettingCountOnTable = 1;
    table.currentInfo.roundId = '';
    table.currentInfo._v = 1;
    resolve(input);
}));
let createGameOverResponse = new j_stillery_1.Task((input, resolve, reject) => {
    console.log("createGameOverResponse");
    input.processedData.data.success = true;
    let res = {
        success: true,
        playersResult: input.processedData.data.playersResult,
        dealer: input.processedData.data.dealer,
        endingType: input.processedData.data.endingType,
        rakeDeducted: input.processedData.data.rakeDeducted,
        chipsBroadcast: input.processedData.data.chipsBroadcast,
        addChipsFailed: input.processedData.data.addChipsFailed,
        response: input.processedData.data,
        rdr: input.processedData.data.rakeDistributionResult,
        dealerHoldCardDistributeBroadCast: input.processedData.data.dealerHoldCardDistributeBroadCast
    };
    input.processedData.data.gameOverResponse = res;
    resolve(input);
});
function processWinnerAndLosserDecision(input, table) {
    return __awaiter(this, void 0, void 0, function* () {
        const { dealer, players, isInsurancePlacedOnTable = false } = table.currentInfo;
        const dealerHigerValidValue = engine.getHigherValidValue(engine.calculate(dealer.hand));
        const dealerHasBlackjack = engine.isBlackjack(dealer.hand); //meaning either insurance Placed or not dealer just opened it's hold card
        const dealerHasBusted = dealerHigerValidValue > 21 ? true : false;
        const result = [];
        input.processedData.data.dealer = JSON.parse(JSON.stringify(input.processedData.table.currentInfo.dealer));
        const playingPlayers = players.filter((player) => player.state === types_1.PlayerState.Playing);
        playingPlayers.forEach((player) => {
            let winnerPlayer = {
                chips: player.chips,
                playerId: player.playerId,
                playerName: player.playerName,
                seatIndex: player.seatIndex,
                handInfo: {
                    left: {},
                    right: {}
                },
                insuranceData: {
                    isInsurancePlaced: false,
                    playerSideBet: 0,
                    status: '', //"WON"|"LOSS",
                    profit: 0,
                    winningAmount: 0
                },
                winningAmount: 0,
                profit: 0
            };
            const handInfo = player.handInfo;
            const hasSplit = player.history.some((history) => history.type === gameConstants_1.PlayerMove.Split);
            if (hasSplit) {
                //player can have both hand handling below
                for (const key in handInfo) {
                    let profit = 0;
                    let winningAmount = 0;
                    if (handInfo.hasOwnProperty(key)) {
                        const hand = (handInfo[key]);
                        const playerHandCards = hand.cards;
                        const playerHigherValidValue = engine.getHigherValidValue(engine.calculate(playerHandCards));
                        const playerHasBlackjack = engine.isBlackjack(playerHandCards);
                        const playerHasBusted = hand.hasBusted;
                        const bet = Math.trunc(hand.initialBet);
                        const playerHandInfo = JSON.parse(JSON.stringify(hand));
                        const outputHandInfoDetail = {
                            cards: playerHandInfo.cards,
                            close: playerHandInfo.close,
                            hasBlackjack: playerHandInfo.hasBlackjack,
                            hasBusted: playerHandInfo.hasBusted,
                            handValue: playerHandInfo.handValue
                        };
                        winnerPlayer.handInfo[key] = outputHandInfoDetail;
                        if (playerHasBusted) {
                            continue;
                        }
                        else if (dealerHasBusted) {
                            //this Hand is Win Hand 
                            const winningMultiplier = playerHasBlackjack ? 1.5 : 1;
                            winningAmount = bet + Math.trunc(bet * winningMultiplier);
                            winnerPlayer.chips += winningAmount;
                            profit = Math.trunc(bet * winningMultiplier);
                            winnerPlayer.handInfo[key].status = "WON";
                        }
                        else {
                            let winningMultiplier = (playerHasBlackjack || playerHigherValidValue === 21)
                                ? ((dealerHasBlackjack || dealerHigerValidValue === 21) ? 0 : (playerHasBlackjack ? 1.5 : 1))
                                : (playerHigherValidValue > dealerHigerValidValue) ? 1
                                    : (playerHigherValidValue === dealerHigerValidValue) ? 0
                                        : -1;
                            winningAmount = bet + Math.trunc(bet * winningMultiplier);
                            winnerPlayer.chips += winningAmount;
                            profit = bet * winningMultiplier <= 0 ? 0 : bet * winningMultiplier;
                            winnerPlayer.handInfo[key].status = winningMultiplier < 0 ? "LOSS" : (winningMultiplier === 0 ? "PUSH" : "WON");
                        }
                    }
                    winnerPlayer.winningAmount += winningAmount;
                    winnerPlayer.profit += profit;
                }
                // handling Insurance Amount if placed
                if (isInsurancePlacedOnTable) {
                    const isInsurancePlaced = player.hasPlacedInsurance || false;
                    const winningMultiplierForInsurance = dealerHasBlackjack ? 1 : -1;
                    if (isInsurancePlaced) {
                        winnerPlayer.insuranceData.playerSideBet = player.sideBet;
                        winnerPlayer.insuranceData.winningAmount = Math.trunc(player.sideBet) + (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                        winnerPlayer.insuranceData.status = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? "LOSS" : "WON";
                        winnerPlayer.insuranceData.profit = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? 0 : (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                    }
                    winnerPlayer.insuranceData.isInsurancePlaced = isInsurancePlaced;
                    winnerPlayer.chips += winnerPlayer.insuranceData.winningAmount;
                    winnerPlayer.winningAmount += winnerPlayer.insuranceData.winningAmount;
                    winnerPlayer.profit += winnerPlayer.insuranceData.profit;
                }
                result.push(winnerPlayer);
            }
            else {
                // if not splitted then player can only have rightHandCard
                // also insurance Case
                const playerRightHandCards = handInfo.right.cards;
                const playerHigherValidValue = engine.getHigherValidValue(engine.calculate(playerRightHandCards));
                const playerHasBlackjack = engine.isBlackjack(playerRightHandCards);
                const playerHasBusted = handInfo.right.hasBusted;
                //if playerHasBusted his chips are already taken By Dealer so return for those player
                if (playerHasBusted) {
                    //insurance Case
                    if (isInsurancePlacedOnTable) {
                        const isInsurancePlaced = player.hasPlacedInsurance || false;
                        const winningMultiplierForInsurance = dealerHasBlackjack ? 1 : -1;
                        if (isInsurancePlaced) {
                            winnerPlayer.insuranceData.playerSideBet = player.sideBet;
                            winnerPlayer.insuranceData.winningAmount = Math.trunc(player.sideBet) + (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                            winnerPlayer.insuranceData.status = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? "LOSS" : "WON";
                            winnerPlayer.insuranceData.profit = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? 0 : (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                        }
                        winnerPlayer.insuranceData.isInsurancePlaced = isInsurancePlaced;
                        winnerPlayer.chips += winnerPlayer.insuranceData.winningAmount;
                        winnerPlayer.winningAmount += winnerPlayer.insuranceData.winningAmount;
                        winnerPlayer.profit += winnerPlayer.insuranceData.profit;
                    }
                    result.push(winnerPlayer);
                    return;
                }
                else if (dealerHasBusted) {
                    // this is the win Hand for player
                    //will see types later for win and Loss and push
                    // insurance Case will never come
                    const winningMultiplier = playerHasBlackjack ? 1.5 : 1;
                    winnerPlayer.winningAmount = handInfo.right.initialBet + (Math.trunc(handInfo.right.initialBet) * winningMultiplier);
                    winnerPlayer.chips += winnerPlayer.winningAmount;
                    winnerPlayer.profit = Math.trunc(handInfo.right.initialBet) * winningMultiplier;
                    const playerHandInfo = JSON.parse(JSON.stringify(handInfo.right));
                    const outputHandInfoDetail = {
                        cards: playerHandInfo.cards,
                        close: playerHandInfo.close,
                        hasBlackjack: playerHandInfo.hasBlackjack,
                        hasBusted: playerHandInfo.hasBusted,
                        handValue: playerHandInfo.handValue
                    };
                    winnerPlayer.handInfo.right = outputHandInfoDetail;
                    winnerPlayer.handInfo.right.status = "WON";
                    //insurance Case
                    if (isInsurancePlacedOnTable) {
                        const isInsurancePlaced = player.hasPlacedInsurance || false;
                        const winningMultiplierForInsurance = dealerHasBlackjack ? 1 : -1;
                        if (isInsurancePlaced) {
                            winnerPlayer.insuranceData.playerSideBet = player.sideBet;
                            winnerPlayer.insuranceData.winningAmount = Math.trunc(player.sideBet) + (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                            winnerPlayer.insuranceData.status = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? "LOSS" : "WON";
                            winnerPlayer.insuranceData.profit = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? 0 : (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                        }
                        winnerPlayer.insuranceData.isInsurancePlaced = isInsurancePlaced;
                        winnerPlayer.chips += winnerPlayer.insuranceData.winningAmount;
                        winnerPlayer.winningAmount += winnerPlayer.insuranceData.winningAmount;
                        winnerPlayer.profit += winnerPlayer.insuranceData.profit;
                    }
                    result.push(winnerPlayer);
                }
                else if (!dealerHasBusted) {
                    const winningMultiplier = (playerHasBlackjack || playerHigherValidValue === 21)
                        ? ((dealerHasBlackjack || dealerHigerValidValue === 21) ? 0 : (playerHasBlackjack ? 1.5 : 1))
                        : (playerHigherValidValue > dealerHigerValidValue) ? 1
                            : (playerHigherValidValue === dealerHigerValidValue) ? 0
                                : -1;
                    winnerPlayer.winningAmount = handInfo.right.initialBet + Math.trunc(handInfo.right.initialBet) * winningMultiplier;
                    winnerPlayer.chips += winnerPlayer.winningAmount;
                    winnerPlayer.profit = Math.trunc(handInfo.right.initialBet) * winningMultiplier <= 0 ? 0 : Math.trunc(handInfo.right.initialBet) * winningMultiplier;
                    const playerHandInfo = JSON.parse(JSON.stringify(handInfo.right));
                    const outputHandInfoDetail = {
                        cards: playerHandInfo.cards,
                        close: playerHandInfo.close,
                        hasBlackjack: playerHandInfo.hasBlackjack,
                        hasBusted: playerHandInfo.hasBusted,
                        handValue: playerHandInfo.handValue
                    };
                    winnerPlayer.handInfo.right = outputHandInfoDetail;
                    winnerPlayer.handInfo.right.status = winningMultiplier < 0 ? "LOSS" : (winningMultiplier === 0 ? "PUSH" : "WON");
                    // handling Insurance Amount if placed
                    if (isInsurancePlacedOnTable) {
                        const isInsurancePlaced = player.hasPlacedInsurance || false;
                        const winningMultiplierForInsurance = dealerHasBlackjack ? 1 : -1;
                        if (isInsurancePlaced) {
                            winnerPlayer.insuranceData.playerSideBet = player.sideBet;
                            winnerPlayer.insuranceData.winningAmount = Math.trunc(player.sideBet) + (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                            winnerPlayer.insuranceData.status = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? "LOSS" : "WON";
                            winnerPlayer.insuranceData.profit = (Math.trunc(player.sideBet) * winningMultiplierForInsurance) <= 0 ? 0 : (Math.trunc(player.sideBet) * winningMultiplierForInsurance);
                        }
                        winnerPlayer.insuranceData.isInsurancePlaced = isInsurancePlaced;
                        winnerPlayer.chips += winnerPlayer.insuranceData.winningAmount;
                    }
                    result.push(winnerPlayer);
                }
            }
        });
        if (isInsurancePlacedOnTable) {
            const isAllBusted = checkAllHands(table);
            input.processedData.data.dealerHoldCardDistributeBroadCast = isAllBusted ? true : false;
        }
        let res = {
            result
        };
        return res;
    });
}
;
function checkAllHands(table) {
    for (const player of table.currentInfo.players) {
        if (player.state === types_1.PlayerState.Playing || (player.state === types_1.PlayerState.Disconnected && player.active === true)) {
            const handInfo = player.handInfo;
            const hasSplit = player.history.some((x) => x.type === gameConstants_1.PlayerMove.Split);
            if (hasSplit) {
                const leftBusted = handInfo.left.hasBusted;
                const rightBusted = handInfo.right.hasBusted;
                if (!leftBusted || !rightBusted) {
                    return false; // At least one player has a hand that is not busted
                }
            }
            else {
                const rightBusted = handInfo.right.hasBusted;
                if (!rightBusted) {
                    return false;
                }
            }
        }
    }
    return true; // All players have both hands busted
}
// ### Set player state based on different conditions
function setPlayerState(input, player) {
    // console.log("setPlayerState")
    // logger.info("setPlayerState called")
    let table = input.processedData.table;
    // If player is diconnected then only increment disconnected Game missed player
    if (player.state === types_1.PlayerState.Disconnected) {
        // logger.info(`${player.playerName} player state is - ${player.state}, incremented disconnected game missed: ${player.disconnectedMissed}`);
        player.disconnectedMissed = player.disconnectedMissed + 1;
        // logger.info(player.playerName + ' player state is - ' + player.state + ', incremented disconnected game missed: ' + player.disconnectedMissed)
        //.info, player.playerName + ' player state is - ' + player.state + ', incremented disconnected game missed: ' + player.disconnectedMissed);
        return;
    }
    // If player is reserved then skip changing player state
    if (player.state === types_1.PlayerState.Reserved) {
        // logger.info(`${player.playerName} player state is - ${player.state}, not processing state change for this player.`);
        //info, player.playerName + ' player state is - ' + player.state + ', not processing state change for this player.');
        return;
    }
    // Change state for bankrupt players
    if (player.state === types_1.PlayerState.OnBreak) {
    }
    else {
        player.state = player.chips <= 0 ? types_1.PlayerState.OutOfMoney : player.state;
        player.state = player.chips > 0 && player.state === types_1.PlayerState.OutOfMoney ? types_1.PlayerState.Playing : player.state;
    }
}
;
