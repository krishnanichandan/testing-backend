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
exports.SchedulerHelper = void 0;
const schedule = __importStar(require("node-schedule"));
const GameSessionHelper_1 = require("./GameSessionHelper");
const leaveHelper_1 = require("../game/leaveHelper");
const colyseus_1 = require("colyseus");
const Queries_1 = require("../../db/Queries");
const INACTIVE_PLAYER_TIME = 5 * 60; //10;//seconds
const REMOVE_PLAYER_SESSION_EXCEEDED = 15;
class SchedulerHelper {
    constructor() {
        this.removeInactivePlayerJobs = {};
        this.playerPlaySessionJobs = {};
        this.removePlayer = {};
        this.removePlayerBetNotResponded = {};
    }
    static get Instance() {
        return this._instance || (this._instance = new this());
    }
    removeInactivePlayer(tableId, playerId) {
        if (!!this.removeInactivePlayerJobs[tableId + "/" + playerId]) {
            console.log("already added");
            return;
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (INACTIVE_PLAYER_TIME * 1000));
        const job = schedule.scheduleJob(scheduleTime, () => __awaiter(this, void 0, void 0, function* () {
            let room = colyseus_1.matchMaker.getRoomById(tableId);
            let leavePayload = {
                playerId: playerId,
                tableId: tableId,
                isStandUp: false,
                isRequested: false,
                room: room
            };
            let res = yield (0, leaveHelper_1.leavePlayer)(leavePayload);
        }));
        this.removeInactivePlayerJobs[tableId + "/" + playerId] = job;
    }
    clearInactivePlayerJob(tableId, playerId) {
        const job = this.removeInactivePlayerJobs[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Inactive Player Job cleared");
            delete this.removeInactivePlayerJobs[tableId + "/" + playerId];
        }
    }
    startPlayerPlaySession(tableId, playerId, PLAYER_PLAY_SESSION) {
        console.log("start Player Play Session Called");
        if (!!this.playerPlaySessionJobs[tableId + "/" + playerId]) {
            console.log("already added");
            return;
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (PLAYER_PLAY_SESSION * 60 * 1000));
        const job = schedule.scheduleJob(scheduleTime, () => __awaiter(this, void 0, void 0, function* () {
            console.log("start Player Play Session Started->");
            let room = colyseus_1.matchMaker.getRoomById(tableId);
            let query = {
                id: tableId,
                'currentInfo.players': {
                    $elemMatch: {
                        playerId: playerId
                    }
                }
            };
            let updateField = {
                $set: {
                    "currentInfo.players.$.playerPlaySessionExceeded": true
                }
            };
            yield (0, Queries_1.updateTableSettingsInDb)({ filter: query, updateObj: updateField });
        }));
        this.playerPlaySessionJobs[tableId + "/" + playerId] = job;
    }
    clearPlayerPlaySession(tableId, playerId) {
        const job = this.playerPlaySessionJobs[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Player session Job cleared");
            delete this.playerPlaySessionJobs[tableId + "/" + playerId];
        }
    }
    removePlayerIfSessionExceed(tableId, playerId) {
        console.log("Remove Player Called");
        if (!!this.removePlayer[tableId + "/" + playerId]) {
            console.log("already added");
            return;
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (REMOVE_PLAYER_SESSION_EXCEEDED * 1000));
        const job = schedule.scheduleJob(scheduleTime, () => __awaiter(this, void 0, void 0, function* () {
            console.log("Remove Player Started->");
            let room = colyseus_1.matchMaker.getRoomById(tableId);
            let payload = {
                playerId: playerId,
                tableId: tableId,
                room: room,
                isPlayerWantsToContinueGameSession: false
            };
            let res = yield (0, GameSessionHelper_1.continueGameSession)(payload);
        }));
        this.removePlayer[tableId + "/" + playerId] = job;
    }
    clearRemovePlayerJob(tableId, playerId) {
        const job = this.removePlayer[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Remove Player Job cleared");
            delete this.removePlayer[tableId + "/" + playerId];
        }
    }
    isJobScheduledForRemovePlayerSessionPopUp(tableId, playerId) {
        const job = this.removePlayer[tableId + "/" + playerId];
        if (job)
            return true;
        else
            return false;
    }
    removePlayerIfBetPhasePopNotResponsd(tableId, playerId) {
        console.log("Remove Player bet phase Called");
        if (!!this.removePlayerBetNotResponded[tableId + "/" + playerId]) {
            console.log("already added");
            return;
        }
        const currentTime = new Date();
        const scheduleTime = new Date(currentTime.getTime() + (REMOVE_PLAYER_SESSION_EXCEEDED * 1000));
        const job = schedule.scheduleJob(scheduleTime, () => __awaiter(this, void 0, void 0, function* () {
            console.log("Remove Player bet phase started");
            let room = colyseus_1.matchMaker.getRoomById(tableId);
            let payload = {
                room: room,
                playerId: playerId,
                tableId: tableId,
                isPlayerWantsToContinueBetPhase: false
            };
            let res = yield (0, GameSessionHelper_1.continueBetPhase)(payload);
        }));
        this.removePlayerBetNotResponded[tableId + "/" + playerId] = job;
    }
    isJobScheduledForBetPhase(tableId, playerId) {
        const job = this.removePlayerBetNotResponded[tableId + "/" + playerId];
        if (job)
            return true;
        else
            return false;
    }
    clearRemovePlayerBetPhasePopUpJob(tableId, playerId) {
        const job = this.removePlayerBetNotResponded[tableId + "/" + playerId];
        if (job) {
            job.cancel();
            console.log("Remove Player bet Pop Up cleared");
            delete this.removePlayerBetNotResponded[tableId + "/" + playerId];
        }
    }
}
exports.SchedulerHelper = SchedulerHelper;
