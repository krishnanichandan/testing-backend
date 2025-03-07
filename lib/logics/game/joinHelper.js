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
exports.processJoin = void 0;
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const types_1 = require("./types");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const Queries_1 = require("../../db/Queries");
const DbManager_1 = require("../../db/DbManager");
const broadcaster_1 = require("./broadcaster");
const masterQueries_1 = require("../../db/masterQueries");
const colyseus_1 = require("colyseus");
const ResponseMaker_1 = require("../../dataFormats/ClientDataFormat.ts/ResponseMaker");
// Export the processJoin function which handles a player's request to join a table
function processJoin(data) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        console.log("process Join called", data);
        // Define an array of tasks to be executed in sequence as part of the join process
        let arr = [initData, validatePayloadTask, getTableDataFromDb, addPlayerAsSpectatorToDb, updatePlayerStateIfSeated, makeClientResponseFormat, startIdleTimer];
        let pipeline = (new j_stillery_1.Pipeline());
        // Pipe each task into the pipeline to be executed sequentially
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        // Run the pipeline with the provided data and handle any errors that occur
        let result = yield pipeline.run(data).catch((e) => {
            console.log(e);
            catchedError = e;
        });
        // If the pipeline executed successfully and returned a result
        if (!!result) {
            console.log("processJoin result->", JSON.stringify(result));
            if (((_a = result.processedData) === null || _a === void 0 ? void 0 : _a.errorData) && !((_c = (_b = result.processedData) === null || _b === void 0 ? void 0 : _b.errorData) === null || _c === void 0 ? void 0 : _c.success)) {
                let toReturn = (_d = result.processedData) === null || _d === void 0 ? void 0 : _d.errorData;
                return toReturn;
            }
            let toReturn = { success: true, response: result.processedData.returnData.tableJoinResponse };
            return toReturn;
        }
        else {
            console.log("processJoin Error->", result);
            let toReturn = catchedError.processedData.errorData;
            return toReturn;
        }
    });
}
exports.processJoin = processJoin;
let initData = new j_stillery_1.Task((input, resolve, reject) => {
    input.processedData = {
        data: { settings: {}, tableFound: false, isFirstJoin: true, chipsIn: 0, game_timeOut_min: 25, spectatorPlayer: [] },
        table: null
    };
    resolve(input);
});
let validatePayloadTask = new j_stillery_1.Task((input, resolve, reject) => {
    if (!!input.tableId && !!input.playerId) {
        resolve(input);
    }
    else {
        let errorData = { success: false, tableId: (input.tableId || ""), info: "Key id or playerId not found or contains blank value!" };
        input.processedData.errorData = errorData;
        reject(input);
    }
});
let getTableDataFromDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = yield LockerHelper.getTable(input.tableId, "JoinProcess").catch(e => { console.log("fetch table error", e); });
    if (!table) {
        input.processedData.errorData = { success: false, information: "Table not found for this id", info: "No active tables found. Please, try again!" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
}));
let addPlayerAsSpectatorToDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    //manage table settings too
    let playerRecord = yield (0, Queries_1.findPlayerOnTableJoinRecord)({ tableId: input.tableId, playerId: input.playerId });
    if (!!playerRecord) {
        input.processedData.data.settings = playerRecord.settings;
        input.processedData.data.game_timeOut_min = playerRecord.game_timeOut_min;
        input.processedData.data.isFirstJoin = false;
        input.processedData.data.chipsIn = playerRecord.chipsIn;
    }
    else {
        let player = {};
        player.playerId = input.playerId;
        let playerResult = yield (0, masterQueries_1.findUser)({ playerId: input.playerId }).catch((e) => {
            console.log("find user error ", e);
        });
        if (!playerResult) {
            input.processedData.errorData = ({ success: false, info: "Something went wrong in fetching user" });
            reject(input);
            return;
        }
        input.processedData.data.settings = playerResult.preferences;
        input.processedData.data.chipsIn = playerResult.accountInfo.realChips;
        input.processedData.data.game_timeOut_min = playerResult.loginInfo.game_timeout_min;
        // input.processedData.data.playerPlaySession = playerResult.activityInfo.sessionStartedAt;
        let result = yield (0, Queries_1.upsertPlayerJoin)({ tableId: input.tableId, playerName: input.playerName, playerId: input.playerId, settings: input.processedData.data.settings, chipsIn: input.processedData.data.chipsIn, game_timeOut_min: input.processedData.data.game_timeOut_min, isSpectator: true });
    }
    //also upsert table join record
    resolve(input);
}));
// Change PLAYING if player is in same game from where disconnected
// Change ONBREAK if player is not in same game from where disconnected
// to Do
let updatePlayerStateIfSeated = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    //todos 
    let table = input.processedData.table;
    let playerIndexOnTable = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    if (playerIndexOnTable >= 0) {
        table = input.processedData.table;
        let currentPlayerIndex = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
        let previousState = null;
        let currentState = '';
        if (currentPlayerIndex >= 0) {
            let player = table.currentInfo.players[currentPlayerIndex];
            if (player.state !== types_1.PlayerState.Disconnected) {
                //, 'Player is not in DISCONNECTED state, so skipping player state update!');
            }
            else if (player.roundId !== table.currentInfo.roundId) {
                // Change ONBREAK if player is not in same game from where disconnected
                //, 'Player is in DISCONNECTED state, but not in current game, setting state ONBREAK!');
                previousState = table.currentInfo.players[currentPlayerIndex].state;
                table.currentInfo.players[currentPlayerIndex].state = types_1.PlayerState.Waiting;
                currentState = types_1.PlayerState.Waiting;
            }
            else {
                previousState = table.currentInfo.players[currentPlayerIndex].state;
                // Change player State based on game State and player
                // previous state if player is in same game from where disconnected
                // 'Player is in DISCONNECTED state, and in current game, setting state PLAYING!');
                const playerPreviousStateBeforeDiconnection = table.currentInfo.players[currentPlayerIndex].previousState;
                if (table.currentInfo.state === types_1.GameState.Betting) {
                    if (playerPreviousStateBeforeDiconnection === types_1.PlayerState.Waiting) {
                        table.currentInfo.players[currentPlayerIndex].state = types_1.PlayerState.Waiting;
                        currentState = types_1.PlayerState.Waiting;
                    }
                    else if (playerPreviousStateBeforeDiconnection === types_1.PlayerState.Betting) {
                        //it may arise conflict
                        table.currentInfo.players[currentPlayerIndex].state = types_1.PlayerState.Betting;
                        currentState = types_1.PlayerState.Betting;
                    }
                    else if (playerPreviousStateBeforeDiconnection === types_1.PlayerState.Ready) {
                        table.currentInfo.players[currentPlayerIndex].state = types_1.PlayerState.Ready;
                        currentState = types_1.PlayerState.Ready;
                    }
                }
                else if (table.currentInfo.state === types_1.GameState.Running) {
                    // may arise conflict if player just went disconnected after hitting ready State
                    table.currentInfo.players[currentPlayerIndex].state = [types_1.PlayerState.Waiting, types_1.PlayerState.Playing].includes(table.currentInfo.players[currentPlayerIndex].previousState) ? table.currentInfo.players[currentPlayerIndex].previousState : types_1.PlayerState.Waiting;
                    currentState = [types_1.PlayerState.Waiting, types_1.PlayerState.Playing].includes(table.currentInfo.players[currentPlayerIndex].previousState) ? table.currentInfo.players[currentPlayerIndex].previousState : types_1.PlayerState.Waiting;
                    ;
                }
            }
        }
        if (previousState === types_1.PlayerState.Disconnected) {
            try {
                let room = colyseus_1.matchMaker.getRoomById(table.id);
                if (!!room) {
                    console.log("player Reconected-> ", { tableId: table.id, playerId: input.playerId, playerState: table.currentInfo.players[currentPlayerIndex].state, playerName: table.currentInfo.players[currentPlayerIndex].playerName });
                    (0, broadcaster_1.dispatchPlayerStateBroadcast)(room, { tableId: table.id, playerId: input.playerId, playerState: table.currentInfo.players[currentPlayerIndex].state });
                    let query = {
                        id: table.id,
                        'currentInfo.players': {
                            $elemMatch: {
                                playerId: input.playerId
                            }
                        }
                    };
                    let updateField = {
                        $set: {
                            "currentInfo.players.$.state": currentState,
                            "currentInfo.isOperationOn": false
                        }
                    };
                    let table3 = yield (0, Queries_1.updateTableDataAndUnlock)({ filter: query, updateObj: updateField });
                }
                else {
                    yield (0, Queries_1.forceUnlockTable)(input.tableId);
                }
            }
            catch (e) {
                console.log(e);
            }
        }
        else {
            console.log("Reconnection but not in Disconnected State->", { playerId: input.playerId });
            yield (0, Queries_1.forceUnlockTable)(input.tableId);
        }
    }
    else {
        yield (0, Queries_1.forceUnlockTable)(input.tableId);
    }
    const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = yield tableJoinCollection.find({ tableId: input.tableId, isSpectator: true }).toArray();
    let spectatorPlayer = [];
    result && result.forEach((player) => {
        spectatorPlayer.push(player.playerId);
    });
    input.processedData.data.spectatorPlayer = spectatorPlayer;
    resolve(input);
}));
let makeClientResponseFormat = new j_stillery_1.Task((input, resolve, reject) => {
    //todos 
    let data = {
        settings: input.processedData.data.settings,
        previousState: "", //todos  to be set in updatePlayerStateIfSeated
    };
    let tableJoinResponse = (0, ResponseMaker_1.tableJoinResponseData)(input.processedData.table, input.playerId, data);
    console.log("Client response->", JSON.stringify(tableJoinResponse));
    input.processedData.returnData = {
        tableJoinResponse: Object.assign(Object.assign({}, tableJoinResponse), { spectator: input.processedData.data.spectatorPlayer })
    };
    resolve(input);
});
// ### Start timer to kick player from lobby only if player is not already sitted in NORMAL games
let startIdleTimer = new j_stillery_1.Task((input, resolve, reject) => {
    let table = input.processedData.table;
    let playerIndexOnTable = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    if (playerIndexOnTable < 0) {
    }
    resolve(input);
});
