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
exports.updatePlayerStateOnReconnect = exports.removePlayerSpectatorPlayer = exports.updatePlayerStateOnDisconnect = void 0;
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const types_1 = require("./types");
const leaveHelper_1 = require("./leaveHelper");
const colyseus_1 = require("colyseus");
const Queries_1 = require("../../db/Queries");
const broadcaster_1 = require("./broadcaster");
function getTableDataFromDb(tableId) {
    return __awaiter(this, void 0, void 0, function* () {
        let table = yield LockerHelper.getTable(tableId, "SetStateDisconnect").catch(e => { });
        if (!table) {
            return { success: false, info: "Table not found for this id" };
        }
        return { success: true, table: table };
    });
}
;
function replaceTableToDb(table) {
    return __awaiter(this, void 0, void 0, function* () {
        let modTable = yield (0, Queries_1.replaceTable)(table).catch(e => { console.log(e); });
        if (!modTable) {
            return { success: false, info: "table couldnt be updated after add chips logic" };
        }
        return { success: true };
    });
}
function updatePlayerStateOnDisconnect(playerId, tableId, room) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('updatePlayerStateOnDisconnect started', { playerId: playerId, tableId: tableId });
        let res = yield getTableDataFromDb(tableId);
        if (!res.success) {
            return res;
        }
        let table = res.table;
        let playerIndexOnTable = table.currentInfo.players.findIndex((player) => player.playerId === playerId);
        if (playerIndexOnTable < 0) {
            yield (0, Queries_1.forceUnlockTable)(tableId);
            console.log("updatePlayerStateOnDisconnect -> Player is not sitting.");
            return ({ success: false, info: "Player is not sitting." });
        }
        else {
            if (table.currentInfo.state === types_1.GameState.Betting) {
                if (table.currentInfo.players[playerIndexOnTable].state === types_1.PlayerState.Waiting) {
                    table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                    table.currentInfo.players[playerIndexOnTable].state = types_1.PlayerState.Disconnected;
                }
                if (table.currentInfo.players[playerIndexOnTable].state === types_1.PlayerState.Betting) {
                    table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                    table.currentInfo.players[playerIndexOnTable].state = types_1.PlayerState.Disconnected;
                }
                if (table.currentInfo.players[playerIndexOnTable].state === types_1.PlayerState.Ready) {
                    table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                    table.currentInfo.players[playerIndexOnTable].state = types_1.PlayerState.Disconnected;
                }
            }
            else if (table.currentInfo.state === types_1.GameState.Running) {
                if (table.currentInfo.players[playerIndexOnTable].state === types_1.PlayerState.Waiting) {
                    table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                    table.currentInfo.players[playerIndexOnTable].state = types_1.PlayerState.Disconnected;
                    // SchedulerHelper.Instance.removeSitoutPlayer(tableId, playerId);
                }
                if (table.currentInfo.players[playerIndexOnTable].state === types_1.PlayerState.Playing) {
                    table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                    table.currentInfo.players[playerIndexOnTable].state = types_1.PlayerState.Disconnected;
                }
            }
            let res2 = yield replaceTableToDb(table);
            if (res2.success) {
            }
            else {
                console.log(res2);
            }
            console.log('Dispatched player state after Disconnection broadcast', { tableId: tableId, playerId: playerId, tableState: table.currentInfo.state, state: table.currentInfo.players[playerIndexOnTable].state, previousState: table.currentInfo.players[playerIndexOnTable].previousState });
            (0, broadcaster_1.dispatchPlayerStateBroadcast)(room, { tableId: tableId, playerId: playerId, playerState: table.currentInfo.players[playerIndexOnTable].state });
        }
    });
}
exports.updatePlayerStateOnDisconnect = updatePlayerStateOnDisconnect;
function removePlayerSpectatorPlayer(playerId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('remove Spectator player if App is Killed started', { playerId: playerId });
        let playerJoinedTable = yield (0, Queries_1.findSpectatorPlayerOnTableJoinRecord)({ playerId: playerId, isSpectator: true });
        if (playerJoinedTable && playerJoinedTable.length) {
            playerJoinedTable.forEach((playerTable) => {
                let room = colyseus_1.matchMaker.getRoomById(playerTable.tableId);
                const payload = {
                    tableId: playerTable.tableId,
                    playerId: playerTable.playerId,
                    isStandUp: false,
                    isRequested: false,
                    room: room,
                    playerName: playerTable.playerName
                };
                setTimeout(() => {
                    let res = (0, leaveHelper_1.leavePlayer)(payload);
                }, 200);
            });
        }
    });
}
exports.removePlayerSpectatorPlayer = removePlayerSpectatorPlayer;
function updatePlayerStateOnReconnect(playerId, tableId, room) {
    return __awaiter(this, void 0, void 0, function* () {
    });
}
exports.updatePlayerStateOnReconnect = updatePlayerStateOnReconnect;
