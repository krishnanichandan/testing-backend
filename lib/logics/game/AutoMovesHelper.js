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
exports.performAutoBettingMove = exports.sendTurnFlowBroadcasts = exports.performInsuranceOnTable = void 0;
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const Queries_1 = require("../../db/Queries");
const types_1 = require("./types");
const moveHelper_1 = require("./moveHelper");
const TurnHelper_1 = require("./TurnHelper");
const engine = __importStar(require("../game/engine"));
const gameOverHelper_1 = require("./gameOverHelper");
const broadcaster_1 = require("./broadcaster");
const timerHelper_1 = require("./timerHelper");
const startGameHelper_1 = require("./startGameHelper");
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
function performInsuranceOnTable(data) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        console.log("player Auto Insurance called");
        let arr = [getTableDataFromDb, ifInsuranceAsked, performInsurance];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        data.processedData = {
            data: {
                isGameOver: false,
                isInsuranceAsked: false,
                isInsurancePlacedOnTable: false,
                callMoveHelper: false
            },
            table: null,
            broadcastGameOverData: {}
        };
        let catchedError = null;
        let res = yield pipeline.run(data).catch(e => { console.log("exception in process Auto Insurance"); catchedError = e; });
        if (!!res) {
            let res = yield replaceTableToDb(data.processedData.table);
            if (res.success) {
                console.log("process Auto Insurance Move completed");
                //To Do Clear Insurance Timers
                // dispatchPlayerInsuranceBroadCasts(data.room, { tableId: data.tableId, playerId: data.playerId, isInsurancePlaced: data.processedData.player.hasPlacedInsurance, sideBet: data.processedData.player.sideBet, chips: data.processedData.player.chips, availableActions: {} });
                // dispatchPlayerStateBroadcast(data.room, { tableId: data.tableId, playerId: data.playerId, playerState: data.processedData.player.state });
                sendTurnFlowBroadcasts(data.room, data.processedData.data, data.tableId, data.processedData.table);
                return { success: true };
            }
            else {
                return res;
            }
        }
        else {
            if ((_b = (_a = catchedError.processedData) === null || _a === void 0 ? void 0 : _a.errorData) === null || _b === void 0 ? void 0 : _b.success) {
                let res = yield replaceTableToDb(data.processedData.table);
                if (res.success) {
                    console.log("replace table when game over etc");
                    return { success: true };
                }
                else {
                    return res;
                }
            }
            else {
                if (!!data.processedData.table) {
                    let id = (_c = data.processedData.table) === null || _c === void 0 ? void 0 : _c.id;
                    yield (0, Queries_1.forceUnlockTable)(id); //will include it later
                }
                console.log("process Insurance Move exception", catchedError);
                return;
            }
        }
    });
}
exports.performInsuranceOnTable = performInsuranceOnTable;
let getTableDataFromDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // let table = await fetchTable(input.tableId).catch(e => {
    // });
    let table = yield LockerHelper.getTable(input.tableId, "Auto Insurance Move").catch(e => { });
    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    input.processedData.data.isInsuranceAsked = table.currentInfo.isInsuranceAsked;
    input.processedData.data.isInsurancePlacedOnTable = table.currentInfo.isInsurancePlacedOnTable;
    resolve(input);
}));
let ifInsuranceAsked = new j_stillery_1.Task((input, resolve, reject) => {
    //one more check to know either insurance is asked or not
    if (input.processedData.table.currentInfo.isInsuranceAsked) {
        resolve(input);
    }
    else {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: "Insurance not asked on Table" });
        input.processedData.errorData = ed;
        reject(input);
    }
});
let performInsurance = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let isInsurancePlacedOnTable = input.processedData.table.currentInfo.isInsurancePlacedOnTable;
    let isInsuranceAsked = input.processedData.table.currentInfo.isInsuranceAsked;
    let insurancePlayers = input.processedData.table.currentInfo.players.filter((player) => (player.isInsuranceAsked && (player.state === types_1.PlayerState.Playing || (player.state === types_1.PlayerState.Disconnected && player.hasPlacedInsurance))));
    let disconnectedPlayers = input.processedData.table.currentInfo.players.filter((player) => player.state === types_1.PlayerState.Disconnected && player.active && player.isInsuranceAsked && !player.hasPlacedInsurance);
    disconnectedPlayers.forEach((player) => {
        player.hasPlacedInsurance = false;
        player.isInsuranceAsked = false;
    });
    if (isInsurancePlacedOnTable && insurancePlayers.length) { //game Over Case after holdcardOpen
        insurancePlayers.forEach((player) => {
            player.isInsuranceAsked = false;
        });
        //calling move helper to direct game Over Flow
        // input.processedData.data.callMoveHelper = true;
        // resolve(input);
    }
    //  else {
    let table = input.processedData.table;
    let players = table.currentInfo.players;
    let currentMoveIndex = table.currentInfo.currentMoveIndex;
    let firstActivePlayer = table.currentInfo.players.find((player) => (player.state === types_1.PlayerState.Playing && player.active === true));
    let firstActiveIndex = table.currentInfo.players.indexOf(firstActivePlayer);
    table.currentInfo.firstActiveIndex = firstActiveIndex;
    table.currentInfo.currentMoveIndex = firstActiveIndex;
    let turnResponse = (0, TurnHelper_1.findTurnForPlayers)(table, 'right', false);
    table.currentInfo.currentMoveIndex = turnResponse.currentMoveIndex;
    table.currentInfo.currentPlayingPosition = 'right';
    const playerDataTosend = turnResponse.isDealerMove ? {} : table.currentInfo.players[turnResponse.currentMoveIndex];
    let dataToSend = {};
    console.log("autoMoves->", playerDataTosend, " ", turnResponse.isDealerMove);
    if (playerDataTosend && Object.keys(playerDataTosend).length) {
        dataToSend = {
            seatIndex: playerDataTosend.seatIndex,
            initialBet: playerDataTosend.initialBet,
            turnTime: 10,
            playerId: playerDataTosend.playerId,
            tableId: playerDataTosend.tableId,
            playerName: playerDataTosend.playerName,
            active: playerDataTosend.active,
            chips: playerDataTosend.chips,
            avatar: playerDataTosend.avatar,
            state: playerDataTosend.state,
            isWaitingPlayer: playerDataTosend.isWaitingPlayer,
            sideBet: playerDataTosend.sideBet,
            handInfo: playerDataTosend.handInfo,
            hasBlackJack: playerDataTosend.hasBlackJack,
            hasPlacedInsurance: playerDataTosend.hasPlacedInsurance,
        };
    }
    let turndata = {
        isGameOver: turnResponse.isDealerMove ? true : false,
        turn: {
            isDealerMove: turnResponse.isDealerMove,
            seatIndex: turnResponse.isDealerMove ? -1 : table.currentInfo.players[turnResponse.currentMoveIndex].seatIndex,
            player: dataToSend,
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: turnResponse.currentPlayingPosition
        },
        currentMoveData: {}
    };
    if (turnResponse.isDealerMove) {
        //meaning blackJack Happen and only one player
        //gameOver Case
        table.currentInfo.state = types_1.GameState.Over;
        let payload = {
            processedData: {
                data: {},
                table: table,
            }
        };
        const dealer = table.currentInfo.dealer;
        dealer.hand = [...dealer.hand, dealer.holdCard];
        const dealerPoints = engine.calculate(dealer.hand);
        dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
        const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
        dealer.isBusted = dealerHigherValidValue > 21;
        dealer.isVisible = true;
        dealer.isHoldCardOpened = true;
        dealer.totalPoints = dealerPoints;
        let currentMoveData = {
            isDealerMove: true,
            action: "holdCardOpen",
            dealerPoints,
            handInfo: dealer.hand,
            hasBlackjack: dealer.hasBlackjack,
            isBusted: dealer.isBusted,
            handValue: dealerPoints
        };
        table.currentInfo.dealer = dealer;
        //check this again
        const response = yield (0, gameOverHelper_1.processGameOver)(payload);
        if (response.success) {
            input.processedData.data.isGameOver = true;
            input.processedData.broadcastGameOverData = response.data.gameOverResponse;
        }
        setTimeout(function () {
            console.log('automove helper dispatch turn 1 :: ');
            (0, broadcaster_1.dispatchOnTurnBroadcast)(input.room, { isGameOver: input.processedData.data.isGameOver, turn: { currentMoveData, isDealerMove: true, nextTurnData: {} } });
        }, (2000));
        if (input.processedData.data.isGameOver) {
            setTimeout(function () {
                (0, broadcaster_1.dispatchGameOverBroadcast)(input.room, { playersResult: response.data.gameOverResponse.playersResult, dealer: response.data.gameOverResponse.dealer });
            }, (2000));
        }
        //need to add restart game here i guess
    }
    else {
        let numCards = 2;
        let firstTurnTimer = input.room.clock.setTimeout(function (params) {
            //     // only if move is needed : currentMoveIndex >= 1 (for seatIndex) : TODO maybe
            //     // Send player turn broadcast to channel level
            (0, broadcaster_1.dispatchOnTurnBroadcast)(input.room, turndata);
            (0, timerHelper_1.startTurnTimer)({ room: input.room, table: input.processedData.table, isTurnTime: true });
        }, 300, input);
    }
    // }
    resolve(input);
}));
function replaceTableToDb(table) {
    return __awaiter(this, void 0, void 0, function* () {
        let modTable = yield (0, Queries_1.replaceTable)(table).catch(e => {
            console.log(e);
        });
        if (!modTable) {
            let errorData = { success: false, info: "table couldnt be updated after auto Move logic" };
            return errorData;
        }
        // logger.info('Table successfully replaced in database', { tableId: table.id });
        return { success: true };
    });
}
function sendTurnFlowBroadcasts(room, response, tableId, table) {
    if (response.callMoveHelper) {
        //need to clear existing timer
        (0, timerHelper_1.clearExistingTimers)(room);
        let movePayload = {
            room,
            tableId,
            isDealerMove: true,
            action: "holdCardOpen"
        };
        setTimeout(function () {
            (0, moveHelper_1.processMove)(movePayload)
                .then(() => {
            })
                .catch((error) => {
                console.error("Error processing move:", error);
            });
        }, 1000);
        // }
    }
    if (response.isGameOver) {
        // restart game if game over occurs
        setTimeout(function () {
            let payload = {
                tableId: tableId,
                eventName: "RESUME",
                room: room
            };
            (0, startGameHelper_1.processStartGame)(payload);
        }, (6000));
    }
}
exports.sendTurnFlowBroadcasts = sendTurnFlowBroadcasts;
function performAutoBettingMove(data) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        console.log("playerDeal called");
        let arr = [getTableDataFromDbForBetPhase, checkBettingPhase, resetPlayerState];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        data.processedData = {
            data: {
                isBettingPlayerAvailable: false,
                startGame: false
            },
            table: null,
            errorData: { success: false, info: "" }
        };
        let catchedError = null;
        let res = yield pipeline.run(data).catch(e => { console.log("exception in process Auto Deal"); catchedError = e; });
        if (!!res) {
            let res = yield replaceTableToDb(data.processedData.table);
            if (res.success) {
                console.log("process Auto Deal Move completed");
                let startGamePayload = {
                    eventName: "RESUME",
                    tableId: data.tableId,
                    room: data.room
                };
                setTimeout(() => {
                    (0, startGameHelper_1.processStartGame)(startGamePayload);
                }, 300);
                return { success: true };
            }
            else {
                return res;
            }
        }
        else {
            if ((_b = (_a = catchedError.processedData) === null || _a === void 0 ? void 0 : _a.errorData) === null || _b === void 0 ? void 0 : _b.success) {
                let res = yield replaceTableToDb(data.processedData.table);
                if (res.success) {
                    console.log("replace table when game over etc");
                    return { success: true };
                }
                else {
                    return res;
                }
            }
            else {
                // logger.error('Process move exception', { catchedError });
                if (!!data.processedData.table) {
                    let id = (_c = data.processedData.table) === null || _c === void 0 ? void 0 : _c.id;
                    yield (0, Queries_1.forceUnlockTable)(id); //will include it later
                }
                console.log("process auto Deal Move exception", (_d = catchedError.processedData) === null || _d === void 0 ? void 0 : _d.errorData);
            }
        }
    });
}
exports.performAutoBettingMove = performAutoBettingMove;
let getTableDataFromDbForBetPhase = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // let table = await fetchTable(input.tableId).catch(e => {
    // });
    let table = yield LockerHelper.getTable(input.tableId, "Auto Deal Process").catch(e => { });
    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
}));
let checkBettingPhase = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    if (input.processedData.table.currentInfo.state != types_1.GameState.Betting) {
        input.processedData.errorData = { success: false, info: "Game is not in Betting State" };
        reject(input);
    }
    else if (input.processedData.table.currentInfo.state === types_1.GameState.Betting) {
        resolve(input);
    }
    else {
        input.processedData.errorData = { success: false, info: "Game is not in Betting State" };
        reject(input);
    }
}));
let resetPlayerState = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let bettingPlayers = input.processedData.table.currentInfo.players.filter((player) => (player.state === types_1.PlayerState.Betting || player.state === types_1.PlayerState.Disconnected) && player.active);
    let readyPlayers = input.processedData.table.currentInfo.players.filter((player) => (player.state === types_1.PlayerState.Ready || player.state === types_1.PlayerState.Disconnected) && player.active);
    let isReadyPlayerAvailable = false;
    let isBettingPlayerAvailable = false;
    if (readyPlayers.length) {
        readyPlayers.forEach((player) => {
            if (player.initialBet > 0) {
                player.state = types_1.PlayerState.Ready;
                isReadyPlayerAvailable = true;
            }
        });
    }
    if (bettingPlayers.length) {
        bettingPlayers.forEach((player) => {
            if (player.initialBet > 0) {
                player.state = types_1.PlayerState.Ready;
            }
            else {
                player.state = types_1.PlayerState.Waiting;
                player.showContinueBetPopUp = true;
                player.active = false;
                player.playerDealtInLastRound = false;
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
            }
        });
        bettingPlayers.forEach((player) => {
            if (player.state === types_1.PlayerState.Betting) {
                isBettingPlayerAvailable = true;
            }
        });
    }
    input.processedData.data.isBettingPlayerAvailable = isBettingPlayerAvailable;
    input.processedData.data.startGame = true;
    input.processedData.table.currentInfo.state = isReadyPlayerAvailable ? types_1.GameState.Betting : types_1.GameState.Idle;
    resolve(input);
}));
