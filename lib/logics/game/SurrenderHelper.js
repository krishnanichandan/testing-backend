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
exports.processSurrenderMove = void 0;
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const gameOverHelper_1 = require("./gameOverHelper");
const types_1 = require("./types");
const moveHelper_1 = require("./moveHelper");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const timerHelper_1 = require("./timerHelper");
const broadcaster_1 = require("./broadcaster");
const Queries_1 = require("../../db/Queries");
const gameConstants_1 = require("./gameConstants");
const TurnHelper_1 = require("./TurnHelper");
const masterQueries_1 = require("../../db/masterQueries");
function getTableDataFromDb(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let table = yield LockerHelper.getTable(input.tableId, "Surrender Called").catch(e => { });
        if (!table) {
            input.processedData.errorData = { success: false, info: "Table not found for this id" };
            return false;
        }
        input.processedData.table = table;
        return true;
    });
}
function processSurrenderMove(input) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        console.log("surrender Called");
        input.processedData = {
            table: null,
            data: {
                clearTimer: false,
                action: null,
                index: null,
                state: null,
                chipsTaken: 0,
                isCurrentPlayer: false
            },
            broadCastsTurnData: {},
            broadCastGameOverData: {},
            playerSurrenderBroadCast: {
                playerId: "",
                playerName: "",
                chips: 0,
                seatIndex: -1,
                chipsTaken: 0,
                state: ""
            }
        };
        let tableRes = yield getTableDataFromDb(input);
        if (!tableRes) {
            // logger.error('Error in fetching table while standing up', { playerId: input.playerId });
            console.log("error in fetching table while standing up");
            return;
        }
        let table = input.processedData.table;
        let arr = [checkTableState, validatePlayer, checkPlayerStateAndBet, resetPlayerOnSurrender,
            findTurn];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        let res = yield pipeline.run(input).catch(e => { console.log("exception in surrender player"); catchedError = e; });
        if (!!res) {
            // logger.info('Player leave processed successfully', { playerId: input.playerId });
            let replaceRes = yield replaceTableToDb(input.processedData.table);
            if (replaceRes.success) {
                (0, broadcaster_1.dispatchPlayerSurrenderBroadcast)(input.room, input.processedData.playerSurrenderBroadCast);
                (0, moveHelper_1.sendTurnFlowBroadcasts)(input.room, { isCurrentPlayer: input.processedData.data.isCurrentPlayer, turnData: { isGameOver: input.processedData.data.isGameOver, turn: input.processedData.broadCastsTurnData }, gameOverBroadCasts: input.processedData.broadCastGameOverData }, input.tableId, input.processedData.table);
                return ({ success: true, tableId: input.tableId });
            }
            else {
                return ({ success: false, tableId: input.tableId });
            }
        }
        else {
            // logger.error('Player leave process failed', { playerId: input.playerId, catchedError });
            yield (0, Queries_1.forceUnlockTable)(input.tableId); //will integrate Db later
            console.log(catchedError);
            return ({ success: false, tableId: input.tableId, info: (_b = (_a = catchedError === null || catchedError === void 0 ? void 0 : catchedError.processedData) === null || _a === void 0 ? void 0 : _a.errorData) === null || _b === void 0 ? void 0 : _b.info });
        }
    });
}
exports.processSurrenderMove = processSurrenderMove;
// Async function to replace or update a table in the database
function replaceTableToDb(table) {
    return __awaiter(this, void 0, void 0, function* () {
        let modTable = yield (0, Queries_1.replaceTable)(table).catch(e => { console.log(e); });
        if (!modTable) {
            let errorData = { success: false, info: "table couldnt be updated after move logic" };
            return errorData;
        }
        return { success: true };
    });
}
let checkTableState = new j_stillery_1.Task((input, resolve, reject) => {
    let table = input.processedData.table;
    if (table.currentInfo.state === types_1.GameState.Idle || table.currentInfo.state === types_1.GameState.Over) {
        let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to leave when game is in IDLE or OVER State" });
        input.processedData.errorData = err;
        reject(input);
    }
    resolve(input);
});
let validatePlayer = new j_stillery_1.Task((input, resolve, reject) => {
    let index = input.processedData.table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    if (index < 0) {
        let err = ({ success: false, tableId: input.tableId, info: "player is not on the table" });
        input.processedData.errorData = err;
        reject(input);
    }
    input.processedData.data.index = index;
    resolve(input);
});
let checkPlayerStateAndBet = new j_stillery_1.Task((input, resolve, reject) => {
    let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
    if (player.initialBet > 0) {
        player.chips += Math.trunc(player.initialBet / 2);
        input.processedData.data.chipsTaken = Math.trunc(player.initialBet / 2) + player.sideBet || 0;
        resolve(input);
    }
    else {
        let err = ({ success: false, tableId: input.tableId, info: "unable to surrender" });
        input.processedData.errorData = err;
        reject(input);
    }
});
// Define a new task to reset the player's state upon surrender
let resetPlayerOnSurrender = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // Retrieve the player who is surrendering using the provided index from the table's current information
    let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
    player.initialBet = 0;
    // Update the player's state based on their remaining chips and the table's minimum buy-in requirement
    // If the player has no chips left or fewer chips than the minimum buy-in, set their state to 'OutOfMoney'
    // Otherwise, set their state to 'Waiting' for the next round
    player.state = player.chips <= 0 || player.chips < input.processedData.table.info.minBuyIn ? types_1.PlayerState.OutOfMoney : types_1.PlayerState.Waiting;
    // Reset the player's hand information since they have surrendered
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
    player.isWaitingPlayer = true;
    player.active = false;
    player.isInsuranceAsked = false;
    player.hasPlacedInsurance = false;
    player.onGameStartBuyIn = 0;
    player.onSitBuyIn = 0;
    player.history = [];
    resolve(input);
}));
// This Task is responsible for handling the player surrender action and managing game state transitions based on surrender.
let findTurn = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    // Filter active players who are not in the 'Waiting' state
    let activePlayers = table.currentInfo.players.filter((player) => player.active && player.state != types_1.PlayerState.Waiting);
    // Get a deep copy of the player data at the given index
    let player = JSON.parse(JSON.stringify(table.currentInfo.players[input.processedData.data.index]));
    // Prepare data for broadcasting to other players about this player's surrender
    let playerSurrenderBroadCastData = {
        playerId: input.playerId,
        playerName: player.playerName,
        chips: player.chips,
        chipsTaken: input.processedData.data.chipsTaken,
        state: player.state,
        // state: player.chips <= 0 || player.chips < input.processedData.table.info.minBuyIn ? PlayerState.OutOfMoney : PlayerState.Waiting,
        seatIndex: player.seatIndex
    };
    input.processedData.playerSurrenderBroadCast = playerSurrenderBroadCastData;
    // Prepare data about the player's move for this turn (surrender action)
    let currentMoveData = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: "Surrender",
        playedPosition: 'right',
        seatIndex: player.seatIndex,
        handInfo: player.handInfo,
        popCard: {}
    };
    // Check if there are no active players left (i.e., all players have surrendered)
    if (activePlayers.length === 0) {
        if (input.processedData.data.index === table.currentInfo.currentMoveIndex && table.currentInfo.currentMoveIndex != -1) {
            input.processedData.data.isCurrentPlayer = true;
        }
        (0, timerHelper_1.clearExistingTimers)(input.room);
        input.processedData.table.currentInfo.state = types_1.GameState.Over;
        let gameOverPayload = {
            processedData: {
                data: {},
                table: input.processedData.table,
            }
        };
        // Call the processGameOver function to handle the end of the game
        let response = yield (0, gameOverHelper_1.processGameOver)(gameOverPayload);
        if (response.success) {
            input.processedData.data.isGameOver = true;
            input.processedData.broadCastGameOverData = response.data.gameOverResponse;
            input.processedData.broadCastsTurnData = {
                currentMoveData,
                nextTurnData: {},
                isDealerMove: false
            };
        }
    }
    else {
        // If there are still active players, check if the game is over
        if (input.processedData.data.index === table.currentInfo.currentMoveIndex && table.currentInfo.currentMoveIndex != -1) {
            input.processedData.data.isCurrentPlayer = true;
        }
        // Check if all players' hands are finished and determine if the game is over
        const gameOverResponse = checkAllHands(input.processedData.table);
        if (gameOverResponse) {
            (0, timerHelper_1.clearExistingTimers)(input.room);
            //game Over Occur changing table State
            input.processedData.table.currentInfo.state = types_1.GameState.Over;
            let payload = {
                processedData: {
                    data: {},
                    table: input.processedData.table,
                }
            };
            // Call processGameOver to handle end-of-game logic
            const response = yield (0, gameOverHelper_1.processGameOver)(payload); //add more code
            if (response.success) {
                input.processedData.data.isGameOver = true;
                input.processedData.broadCastGameOverData = response.data.gameOverResponse;
                input.processedData.broadCastsTurnData = {
                    currentMoveData,
                    nextTurnData: {},
                    isDealerMove: false
                };
            }
        }
        else {
            //if player is the one who has current Turn going on
            table.currentInfo.players.sort(function (a, b) { return a.seatIndex - b.seatIndex; });
            let activePlayers = [];
            let inactivePlayer = [];
            table.currentInfo.players.forEach((player) => {
                if (!player.active || player.state === types_1.PlayerState.Waiting) {
                    inactivePlayer.push(player);
                }
                else {
                    activePlayers.push(player);
                }
            });
            input.processedData.data.isGameOver = false;
            table.currentInfo.players = activePlayers.concat(inactivePlayer);
            let nextplayer = table.currentInfo.currentMoveIndex;
            let turnData = {};
            if (input.processedData.data.index === table.currentInfo.currentMoveIndex && table.currentInfo.currentMoveIndex != -1) {
                (0, timerHelper_1.clearExistingTimers)(input.room);
                input.processedData.data.isCurrentPlayer = true;
                console.log('findTurnResponse inside findTurn :: ', table);
                let turnResponse = (0, TurnHelper_1.findTurnForPlayers)(table, 'right', false);
                turnData = {
                    isDealerMove: turnResponse.isDealerMove,
                    seatIndex: turnResponse.isDealerMove ? -1 : input.processedData.table.currentInfo.players[turnResponse.currentMoveIndex].seatIndex,
                    player: turnResponse.isDealerMove ? null : Object.assign(Object.assign({}, input.processedData.table.currentInfo.players[turnResponse.currentMoveIndex]), { turnTime: 10 }),
                    dealer: input.processedData.table.currentInfo.dealer,
                    currentPlayingPosition: turnResponse.isDealerMove ? 'right' : turnResponse.currentPlayingPosition
                };
                nextplayer = turnResponse.isDealerMove ? -1 : input.processedData.table.currentInfo.players[turnResponse.currentMoveIndex].seatIndex;
            }
            nextplayer = input.processedData.data.isCurrentPlayer ? (nextplayer != -1 ? table.currentInfo.players.findIndex((player) => player.seatIndex === nextplayer) : -1) : table.currentInfo.currentMoveIndex;
            table.currentInfo.currentMoveIndex = nextplayer;
            if (turnData.isDealerMove) {
                turnData.nextDecidedActionForDealer = 'holdCardOpen';
            }
            input.processedData.broadCastsTurnData = {
                currentMoveData,
                nextTurnData: turnData,
                isDealerMove: turnData.isDealerMove
            };
        }
    }
    resolve(input);
}));
// This function checks if all players' hands are busted in the game.
function checkAllHands(table) {
    for (const player of table.currentInfo.players) {
        if (player.state === types_1.PlayerState.Playing || (player.state === types_1.PlayerState.Disconnected && player.active === true)) {
            const handInfo = player.handInfo;
            // Check if the player has split their hand into two parts (left and right)
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
function updatePlayerStatsToDb(tablePlayer) {
    return __awaiter(this, void 0, void 0, function* () {
        let updateKeys = {
            statistics: tablePlayer.stats
        };
        //will integrate DB later
        let result = yield (0, masterQueries_1.updateUser)({ playerId: tablePlayer.playerId }, updateKeys).catch((e) => {
            console.log("update user error ", e);
            console.log("check y");
        });
        // console.log(result)
    });
}
