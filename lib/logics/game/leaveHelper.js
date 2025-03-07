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
exports.leavePlayer = void 0;
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const types_1 = require("./types");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const Queries_1 = require("../../db/Queries");
const DbManager_1 = require("../../db/DbManager");
const gameConstants_1 = require("./gameConstants");
const SchedulerHelper_1 = require("./SchedulerHelper");
const chipsManagement_1 = require("./chipsManagement");
const moveHelper_1 = require("./moveHelper");
const masterQueries_1 = require("../../db/masterQueries");
function getTableDataFromDb(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let table = yield LockerHelper.getTable(input.tableId, "Leave").catch(e => { });
        if (!table) {
            input.processedData.errorData = { success: false, info: "Table not found for this id" };
            return false;
        }
        input.processedData.table = table;
        return true;
    });
}
function leavePlayer(input) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("leave Called", { playerId: input.playerId });
        input.processedData = {
            table: null,
            data: {
                clearTimer: false,
                action: null,
                index: null,
                state: null,
                feedBackDataToIvoree: {
                    chipsIn: 0,
                    chipsOut: 0,
                    totalBetInGame: 0,
                    playerId: null,
                }
            },
        };
        let tableRes = yield getTableDataFromDb(input);
        if (!tableRes) {
            console.log("error in fetching table while standing up");
            return;
        }
        let table = input.processedData.table;
        let arr = [setLeaveParams, validateAction, updateCareerRecord, refundAmountOnLeave, onLeaveSummary,
            removeFromTable, adjustActiveIndexes, generateResponse];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        let res = yield pipeline.run(input).catch(e => { console.log("exception in leave player"); catchedError = e; });
        if (!!res) {
            let replaceRes = yield replaceTableToDb(input.processedData.table);
            if (replaceRes.success) {
                sendLeaveAndTurnBroadcast(input);
                return ({ success: true, tableId: input.tableId });
            }
            else {
                return ({ success: false, tableId: input.tableId });
            }
        }
        else {
            console.log('Player leave process failed', { playerId: input.playerId, catchedError });
            yield (0, Queries_1.forceUnlockTable)(input.tableId); //will integrate Db later
            console.log(catchedError);
            return ({ success: false, tableId: input.tableId, info: catchedError === null || catchedError === void 0 ? void 0 : catchedError.processedData.errorData.info });
        }
        // }
    });
}
exports.leavePlayer = leavePlayer;
let setLeaveParams = new j_stillery_1.Task((input, resolve, reject) => {
    input.processedData.data.action = input.isStandUp ? gameConstants_1.PlayerMove.StandUp : gameConstants_1.PlayerMove.Leave;
    input.processedData.data.index = input.processedData.table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    if (input.processedData.data.index >= 0) {
        let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
        if (player.initialBet > 0) {
            let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to leave as you have placed Bet" });
            input.processedData.errorData = err;
            // logger.warn('Invalid stand up action for player', { playerId: input.playerId, error: err });
            reject(input);
        }
    }
    resolve(input);
});
// > Spectator player cannot opt to standup
let validateAction = new j_stillery_1.Task((input, resolve, reject) => {
    // logger.info('Validating player action', { playerId: input.playerId, action: input.processedData.data.action });
    // Validate if this standup or leave is allowed for this player
    // check cases as listed (with exported function)
    function checkOrigin(input) {
        if (input.processedData.data.origin) {
            if (input.processedData.data.origin == 'kickToLobby') {
                if (input.processedData.data.index < 0) {
                    return { success: true };
                }
                else {
                    return ({ success: false, tableId: input.tableId, info: 'Kick to lobby is only allowed for observer.' });
                }
            }
            else if (input.processedData.data.origin == 'vacantSeat') {
                if (input.processedData.data.index >= 0 && input.processedData.table.currentInfo.players[input.processedData.data.index].state == types_1.PlayerState.Reserved) {
                    return { success: true };
                }
                else {
                    if (input.processedData.data.index < 0) {
                        return { success: true };
                    }
                    else {
                        return ({ success: false, tableId: input.tableId, info: 'Vacant reserved seat is only allowed for observer/ RESERVED sitting.' });
                    }
                }
            }
            else if (input.processedData.data.origin == 'tableIdleTimer') {
                if (input.processedData.table.currentInfo.state == types_1.GameState.Idle) {
                    return { success: true };
                }
                else {
                    return ({ success: false, tableId: input.tableId, info: 'Leave on idle table is only allowed when idle table.' });
                }
            }
            else if (input.processedData.data.origin == 'idlePlayer') {
                if (input.processedData.data.index >= 0 && input.processedData.table.currentInfo.players[input.processedData.data.index].state == types_1.PlayerState.OnBreak) {
                    return { success: true };
                }
                else {
                    if (input.processedData.data.index < 0) {
                        return { success: true };
                    }
                    else {
                        return ({ success: false, tableId: input.tableId, info: 'Idle player removal is only allowed for observer/ ONBREAK sitting.' });
                    }
                }
            }
            else {
                return { success: true };
            }
        }
        else {
            return { success: true };
        }
    }
    if (input.processedData.data.index < 0 && input.processedData.data.action === gameConstants_1.PlayerMove.StandUp) {
        let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to stand up, please choose Leave." });
        input.processedData.errorData = err;
        // logger.warn('Invalid stand up action for player', { playerId: input.playerId, error: err });
        reject(input);
    }
    else {
        let res = checkOrigin(input);
        if (res.success) {
            resolve(input);
        }
        else {
            input.processedData.errorData = res;
            // logger.error('Player action validation failed', { playerId: input.playerId, error: res });
            reject(input);
        }
    }
});
//leaving it for future
let updateCareerRecord = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    resolve(input);
}));
// Refund amount to player after leave
// refund only player.chips
let refundAmountOnLeave = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    if (input.processedData.data.index >= 0) {
        var chipsToRefund = input.processedData.table.currentInfo.players[input.processedData.data.index].chips;
        const totalBetInGame = input.processedData.table.currentInfo.players[input.processedData.data.index].totalBetOnTable;
        const chipsIn = input.processedData.table.currentInfo.players[input.processedData.data.index].chipsIn;
        let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
        if (player.showContinueBetPopUp) {
            player.showContinueBetPopUp = false;
        }
        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }
        var instantBonusAmount = input.processedData.table.currentInfo.players[input.processedData.data.index].instantBonusAmount;
        if (player.initialBet > 0) {
            let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to leave as you have placed Bet" });
            input.processedData.errorData = err;
            reject(input);
        }
        if (chipsToRefund > 0) {
            let payload = {
                playerId: input.playerId,
                chips: chipsToRefund,
                isRealMoney: input.processedData.table.info.isRealMoney,
                instantBonusAmount: instantBonusAmount,
                category: "Table Actions",
                subCategory: "Leave",
                tableName: input.processedData.table.info.name
            };
            let addChipsResponse = yield (0, chipsManagement_1.addChips)(payload);
            if (addChipsResponse.success) {
                if (input.processedData.table.info.isRealMoney) {
                    input.processedData.updatedChips = {
                        realChips: addChipsResponse.newBalance
                    };
                }
                else {
                    input.processedData.updatedChips = {
                        playChips: addChipsResponse.newBalance
                    };
                }
                input.processedData.data.feedBackDataToIvoree = {
                    chipsIn: chipsIn,
                    totalBetInGame: totalBetInGame,
                    chipsOut: chipsToRefund,
                    playerId: input.playerId,
                };
                resolve(input);
            }
            else {
                input.processedData.errorData = { success: false, info: "Refund money failed on leave" };
                reject(input);
            }
        }
        else {
            resolve(input);
        }
    }
    else {
        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }
        const playerOnTableJoinRecord = yield (0, Queries_1.findPlayerOnTableJoinRecord)({ tableId: input.tableId, playerId: input.playerId });
        if (!!playerOnTableJoinRecord) {
            const totalBetInGame = 0;
            const chipsIn = playerOnTableJoinRecord.chipsIn;
            input.processedData.data.feedBackDataToIvoree = {
                chipsIn: chipsIn,
                totalBetInGame: totalBetInGame,
                chipsOut: chipsIn,
                playerId: input.playerId,
            };
        }
        resolve(input);
    }
}));
function createPassbookEntry(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var passbookData = {
            time: Number(new Date()),
            prevAmt: "what after last add chip on table",
            category: "Table Actions",
            amount: 0,
            newAmt: "same as prevAmt",
            subCategory: "Leave",
            tableName: input.processedData.table.info.name
        };
        var query = { playerId: input.playerId };
    });
}
;
// generate summary text on leave and add to params.table.summaryOfAllPlayers
let onLeaveSummary = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    if (input.processedData.data.state == types_1.PlayerState.Playing) {
    }
    resolve(input);
}));
// Remove player object from player array on table
let removeFromTable = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // logger.info('Initiating player removal from table', { playerId: input.playerId, tableId: input.tableId });
    if (input.processedData.data.index >= 0) {
        var removedPlayers = input.processedData.table.currentInfo.players.splice(input.processedData.data.index, 1); // splice returns removed elements array
        if (removedPlayers.length > 0) {
            input.processedData.table.currentInfo.vacantSeats += 1;
            for (let i = 0; i < removedPlayers.length; i++) {
                let player = removedPlayers[i];
                yield updatePlayerStatsToDb(player);
            }
        }
    }
    if (input.processedData.table.currentInfo.players.length === 0) {
        input.processedData.data.clearTimer = true;
        //meaning no players to play game reseting Table Here
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
        table.currentInfo._v = 1;
        let dealer = table.currentInfo.dealer;
        dealer.hand = [];
        // dealer.holdCard = {};
        dealer.holdCard = null;
        dealer.isHoldCardOpened = false;
        dealer.totalPoints = { hi: 0, lo: 0 };
        dealer.isSoft17 = false;
        dealer.isBusted = false;
        dealer.hasBlackjack = false;
        dealer.isVisible = false;
        table.currentInfo.dealer = dealer;
    }
    // todos below commented stuff
    //will do it later as per requirment
    if (input.isStandUp) {
    }
    else {
        let result = yield (0, Queries_1.removePlayerJoin)({ tableId: input.tableId, playerId: input.playerId });
        SchedulerHelper_1.SchedulerHelper.Instance.clearInactivePlayerJob(input.tableId, input.playerId);
        SchedulerHelper_1.SchedulerHelper.Instance.clearPlayerPlaySession(input.tableId, input.playerId);
        SchedulerHelper_1.SchedulerHelper.Instance.clearRemovePlayerJob(input.tableId, input.playerId);
        SchedulerHelper_1.SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
    }
    resolve(input);
}));
// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
let adjustActiveIndexes = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    resolve(input);
}));
// generte response when player leave
// case > no game running on table
let generateResponse = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = yield tableJoinCollection.find({ tableId: input.tableId, isSpectator: true }).toArray();
    let spectatorPlayer = [];
    result && result.forEach((player) => {
        spectatorPlayer.push(player.playerId);
    });
    let data2 = {
        success: true,
        tableId: input.tableId,
        isGameOver: false,
        isCurrentPlayer: false,
        isRoundOver: false,
        playerLength: input.processedData.table.currentInfo.players.length,
        isSeatsAvailable: 3 !== input.processedData.table.currentInfo.players.length,
        leaveBroadcast: {
            success: true,
            clearTimer: input.processedData.data.clearTimer ? true : false,
            tableId: input.tableId,
            playerId: input.playerId,
            playerName: input.playerName,
            isStandUp: input.processedData.data.action === gameConstants_1.PlayerMove.StandUp,
            chips: {
                realChips: (_a = input.processedData.updatedChips) === null || _a === void 0 ? void 0 : _a.realChips,
                playChips: (_b = input.processedData.updatedChips) === null || _b === void 0 ? void 0 : _b.playChips
            },
            spectator: spectatorPlayer
        },
        feedBackDataToIvoree: input.processedData.data.feedBackDataToIvoree || {},
        turn: {},
        round: {},
        over: {}
    };
    let data = {
        isGameOver: false,
        isCurrentPlayer: false,
        // roundName:
        turnData: data2
    };
    input.processedData.data.leaveResponse = data;
    resolve(input);
}));
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
function sendLeaveAndTurnBroadcast(input) {
    setTimeout(() => {
        (0, moveHelper_1.sendTurnFlowBroadcasts)(input.room, input.processedData.data.leaveResponse, input.tableId, input.processedData.table);
    }, 50);
}
//#endregion
