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
exports.processDealMove = void 0;
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const Queries_1 = require("../../db/Queries");
const types_1 = require("./types");
const gameConstants_1 = require("./gameConstants");
const startGameHelper_1 = require("./startGameHelper");
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const broadcaster_1 = require("./broadcaster");
const SchedulerHelper_1 = require("./SchedulerHelper");
function processDealMove(data) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        console.log("playerDeal called");
        let arr = [getTableDataFromDb, initData, ifMoveValid, validateMinAndMaxBet, validateProfileAmount];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        data.processedData = {
            data: {
                index: -1,
                isGameOver: false,
                chips: 0,
                seatIndex: 0,
                amount: 0,
                playerId: "",
                deductTableChipsResponse: {},
                isCurrentPlayer: false,
                action: "",
                playerName: ""
            },
            table: null,
            player: null,
        };
        let catchedError = null;
        let res = yield pipeline.run(data).catch(e => { console.log("exception in process move"); catchedError = e; });
        if (!!res) {
            let res = yield replaceTableToDb(data.processedData.table);
            if (res.success) {
                SchedulerHelper_1.SchedulerHelper.Instance.clearInactivePlayerJob(data.tableId, data.playerId);
                console.log("process Deal Move completed");
                //To Do Clear Deal Timers
                (0, broadcaster_1.dispatchPlayerDealBroadCast)(data.room, { tableId: data.tableId, playerId: data.playerId, player: data.processedData.player });
                (0, broadcaster_1.dispatchPlayerStateBroadcast)(data.room, { tableId: data.tableId, playerId: data.playerId, playerState: data.processedData.player.state });
                // sendTurnFlowBroadcasts(data.room, data.processedData.broadCastNextTurnData, data.tableId, data.processedData.table);
                setTimeout(function () {
                    let dataToStart = { tableId: data.tableId, eventName: "RESUME", room: data.room };
                    (0, startGameHelper_1.processStartGame)(dataToStart);
                }, 200);
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
                console.log("process Deal Move exception", catchedError);
            }
        }
    });
}
exports.processDealMove = processDealMove;
;
let getTableDataFromDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = yield LockerHelper.getTable(input.tableId, "Player Deal").catch(e => { });
    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
}));
let initData = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    input.processedData.data.index = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId && player.state === types_1.PlayerState.Betting);
    // Check if player is in Disconnected state
    // In case auto turn for disconnected players
    if (input.processedData.data.index < 0) {
        input.processedData.data.index = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId && player.state === types_1.PlayerState.Disconnected);
    }
    // Return if no index found while performing action
    if (input.processedData.data.index < 0) {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "UnableToPerform" + input.action });
        input.processedData.errorData = errorData;
        reject(input);
        return;
    }
    input.processedData.player = table.currentInfo.players[input.processedData.data.index];
    let player = input.processedData.player;
    input.processedData.data.playerName = player.playerName;
    input.processedData.data.seatIndex = player.seatIndex;
    input.processedData.data.action = input.action;
    input.processedData.data.isGameOver = (table.currentInfo.state === types_1.GameState.Over);
    input.processedData.data.chips = player.chips;
    input.processedData.data.amount = Math.trunc(input.amount) || 0;
    input.processedData.data.isCurrentPlayer = true;
    input.processedData.data.playerId = input.playerId;
    resolve(input);
}));
let ifMoveValid = new j_stillery_1.Task((input, resolve, reject) => {
    if (Object.values(gameConstants_1.PlayerMove).includes(input.action) && input.processedData.player.initialBet === 0) {
        resolve(input);
    }
    else {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: input.action + " is not a valid move" });
        input.processedData.errorData = ed;
        reject(input);
    }
});
let validateMinAndMaxBet = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    if (input.amount < table.info.minBuyIn || input.amount > table.info.maxBuyIn) {
        const errorData = { success: false, info: "pls place Min Bet", playerId: input.playerId };
        input.processedData.errorData = errorData;
        reject(input);
    }
    else {
        resolve(input);
    }
}));
let validateProfileAmount = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let payload = {
        tableId: input.tableId,
        chips: input.amount,
        playerId: input.playerId,
        player: input.processedData.player
    };
    let deductTableChipsResponse = deductTableChips(payload);
    if (deductTableChipsResponse.success) {
        input.processedData.data.deductTableChipsResponse = deductTableChipsResponse;
        input.processedData.player = deductTableChipsResponse.player;
        input.processedData.table.currentInfo.players[input.processedData.data.index] = input.processedData.player;
        resolve(input);
    }
    else {
        input.processedData.errorData = deductTableChipsResponse;
        // logger.info("validateProfileAmount errorData", input)
        //unlock table forceFully
        reject(input);
        // return
    }
}));
function deductTableChips(input) {
    if (input.chips > input.player.chips) {
        return { success: false, info: "not enough chips select different amount", playerId: input.playerId };
    }
    else {
        let player = input.player;
        let chips = input.chips;
        player.chips = player.chips - chips;
        //reset player State
        player.state = types_1.PlayerState.Ready;
        player.initialBet = chips;
        player.handInfo.right.initialBet = chips;
        player.handInfo.right.availableActions.surrender = true;
        player.playerDealtInLastRound = true;
        player.showContinueBetPopUp = false;
        player.totalBetOnTable += chips;
        player.history.push({
            type: gameConstants_1.PlayerMove.Deal,
            card: [],
            amount: chips,
        });
        //history also
        //playerState Broadcast for Ready and applied chips
        return { success: true, info: "player is Ready to play", player: player };
    }
}
;
function replaceTableToDb(table) {
    return __awaiter(this, void 0, void 0, function* () {
        let modTable = yield (0, Queries_1.replaceTable)(table).catch(e => {
            console.log(e);
        });
        if (!modTable) {
            let errorData = { success: false, info: "table couldnt be updated after move logic" };
            return errorData;
        }
        // logger.info('Table successfully replaced in database', { tableId: table.id });
        return { success: true };
    });
}
