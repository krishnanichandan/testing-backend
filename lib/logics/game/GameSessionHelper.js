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
exports.continueBetPhase = exports.continueGameSession = void 0;
const colyseus_1 = require("colyseus");
const Queries_1 = require("../../db/Queries");
const startGameHelper_1 = require("./startGameHelper");
const SchedulerHelper_1 = require("./SchedulerHelper");
const leaveHelper_1 = require("./leaveHelper");
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
function continueGameSession(input) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!input.tableId || !input.playerId) {
            console.log('Failed to change player Game Session Continue Or Exit', { tableId: input.tableId, playerId: input.playerId });
            return { success: false, info: "Couldn't complete the operation of Continue Game Session" };
        }
        input.processedData = {
            table: null
        };
        let tableRes = yield getTableDataFromDb(input);
        if (!tableRes) {
            // logger.error('Error in fetching table while standing up', { playerId: input.playerId });
            console.log("error in fetching table while Continue Bet Phase Called");
            // await forceUnlockTable(input.tableId);
            return;
        }
        let table = input.processedData.table;
        if (input.isPlayerWantsToContinueGameSession) {
            //resetting player session and starting the game again
            let player = input.processedData.table.currentInfo.players.filter((player) => player.playerId === input.playerId);
            if (player.length) {
                player[0].playerPlaySession = Date.now();
                player[0].playerPlaySessionExceeded = false;
                player[0].previouslyPopUpShowed = false;
                player[0].showContinueBetPopUp = false;
                player[0].playerDealtInLastRound = false;
            }
            let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
            if (!remainingPlayer || !remainingPlayer.length) {
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
            }
            else {
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
            }
            yield (0, Queries_1.replaceTable)(input.processedData.table);
            SchedulerHelper_1.SchedulerHelper.Instance.clearPlayerPlaySession(input.tableId, input.playerId);
            SchedulerHelper_1.SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
            SchedulerHelper_1.SchedulerHelper.Instance.clearInactivePlayerJob(input.tableId, input.playerId);
            SchedulerHelper_1.SchedulerHelper.Instance.clearRemovePlayerJob(input.tableId, input.playerId);
            SchedulerHelper_1.SchedulerHelper.Instance.startPlayerPlaySession(input.tableId, input.playerId, player[0].playerGame_timeOut_min);
            if (!remainingPlayer || !remainingPlayer.length) {
                setTimeout(function () {
                    let data = { tableId: input.tableId, eventName: "RESUME", room: input.room };
                    (0, startGameHelper_1.processStartGame)(data);
                }, 200);
            }
            return { success: true };
        }
        else {
            yield (0, Queries_1.forceUnlockTable)(input.tableId);
            let room = colyseus_1.matchMaker.getRoomById(input.tableId);
            let leavePayload = {
                playerId: input.playerId,
                tableId: input.tableId,
                isStandUp: false,
                isRequested: false,
                room: room
            };
            let res = yield (0, leaveHelper_1.leavePlayer)(leavePayload);
            return res;
        }
    });
}
exports.continueGameSession = continueGameSession;
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
function continueBetPhase(input) {
    return __awaiter(this, void 0, void 0, function* () {
        input.processedData = {
            table: null
        };
        let tableRes = yield getTableDataFromDb(input);
        if (!tableRes) {
            // logger.error('Error in fetching table while standing up', { playerId: input.playerId });
            console.log("error in fetching table while Continue Bet Phase Called");
            return;
        }
        let table = input.processedData.table;
        if (input.isPlayerWantsToContinueBetPhase) {
            let player = input.processedData.table.currentInfo.players.filter((player) => player.playerId === input.playerId);
            if (player.length) {
                player[0].playerDealtInLastRound = false;
                player[0].showContinueBetPopUp = false;
                player[0].previouslyPopUpShowed = false;
            }
            let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
            if (!remainingPlayer || !remainingPlayer.length) {
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
            }
            else {
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
            }
            yield (0, Queries_1.replaceTable)(input.processedData.table);
            SchedulerHelper_1.SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
            if (!remainingPlayer || !remainingPlayer.length) {
                setTimeout(function () {
                    let data = { tableId: input.tableId, eventName: "RESUME", room: input.room };
                    (0, startGameHelper_1.processStartGame)(data);
                }, 200);
            }
            return { success: true };
        }
        else {
            let player = input.processedData.table.currentInfo.players.filter((player) => player.playerId === input.playerId);
            if (player.length) {
                player[0].playerDealtInLastRound = false;
                player[0].showContinueBetPopUp = false;
                player[0].previouslyPopUpShowed = false;
            }
            let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
            if (!remainingPlayer || !remainingPlayer.length) {
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
            }
            else {
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
            }
            yield (0, Queries_1.replaceTable)(input.processedData.table);
            let room = colyseus_1.matchMaker.getRoomById(input.tableId);
            let leavePayload = {
                playerId: input.playerId,
                tableId: input.tableId,
                isStandUp: false,
                isRequested: false,
                room: room
            };
            SchedulerHelper_1.SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
            let res = yield (0, leaveHelper_1.leavePlayer)(leavePayload);
            if (!remainingPlayer || !remainingPlayer.length) {
                setTimeout(function () {
                    let data = { tableId: input.tableId, eventName: "RESUME", room: input.room };
                    (0, startGameHelper_1.processStartGame)(data);
                }, 200);
            }
            return res;
        }
    });
}
exports.continueBetPhase = continueBetPhase;
;
