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
exports.processInsuranceMove = void 0;
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const types_1 = require("./types");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const broadcaster_1 = require("./broadcaster");
const Queries_1 = require("../../db/Queries");
const gameConstants_1 = require("./gameConstants");
const timerHelper_1 = require("./timerHelper");
const AutoMovesHelper_1 = require("./AutoMovesHelper");
function checkAllPlayersPlacedInsurance(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let table = yield (0, Queries_1.fetchTable)(input.tableId).catch(e => {
        });
        if (!table) {
            return;
        }
        else {
            let insurancePlayers = table.currentInfo.players.filter((player) => (player.active && player.isInsuranceAsked && !player.hasPlacedInsurance));
            if (insurancePlayers.length) {
                return;
            }
            else {
                let playersWhoPlacedInsurance = table.currentInfo.players.filter((player) => (player.active && player.isInsuranceAsked && player.hasPlacedInsurance));
                if (playersWhoPlacedInsurance.length) {
                    return;
                    (0, timerHelper_1.clearExistingTimers)(input.room);
                    let movePayload = {
                        room: input.room
                    };
                }
                return;
            }
        }
    });
}
/**
 *
 * @param data PlayerInsurancePayload
 * @returns
 */
function processInsuranceMove(data) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        console.log("player Insurance called");
        let arr = [getTableDataFromDb, initData, ifMoveValid, validateEnoughChips, validateProfileAmount];
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
        let res = yield pipeline.run(data).catch(e => { console.log("exception in process Insurance"); catchedError = e; });
        if (!!res) {
            let res = yield replaceTableToDb(data.processedData.table);
            if (res.success) {
                console.log("process Insurance completed");
                //To Do Clear Insurance Timers
                (0, broadcaster_1.dispatchPlayerInsuranceBroadCasts)(data.room, { tableId: data.tableId, playerId: data.playerId, isInsurancePlaced: data.processedData.player.hasPlacedInsurance, sideBet: data.processedData.player.sideBet, chips: data.processedData.player.chips, availableActions: {}, seatIndex: data.processedData.player.seatIndex });
                let insurancePlayers = data.processedData.table.currentInfo.players.filter((player) => (player.active && player.isInsuranceAsked && !player.hasPlacedInsurance));
                if (insurancePlayers.length) {
                }
                else {
                    (0, timerHelper_1.clearExistingTimers)(data.room);
                    let payload = {
                        tableId: data.tableId,
                        room: data.room
                    };
                    (0, AutoMovesHelper_1.performInsuranceOnTable)(payload);
                }
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
                console.log("process Insurance Move exception", catchedError);
            }
        }
    });
}
exports.processInsuranceMove = processInsuranceMove;
;
let getTableDataFromDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = yield LockerHelper.getTable(input.tableId, "Player Insurance").catch(e => { });
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
    input.processedData.data.index = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId && player.state === types_1.PlayerState.Playing);
    // Check if player is in Disconnected state
    // In case auto turn for disconnected players
    //will check it in auto case-> leaving it as of now
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
    input.processedData.data.amount = Math.trunc(player.initialBet / 2); //it's the amount which player has to give when he will be place insurance
    input.processedData.data.isCurrentPlayer = true;
    input.processedData.data.playerId = input.playerId;
    resolve(input);
}));
let ifInsuranceActionAlreadyTaken = new j_stillery_1.Task((input, resolve, reject) => {
    if (input.processedData.player.insuranceActionTaken) {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: `${input.action} is not allowed here.` });
        input.processedData.errorData = ed;
        reject(input);
    }
    else {
        resolve(input);
    }
});
let ifMoveValid = new j_stillery_1.Task((input, resolve, reject) => {
    //one more check to know either insurance is asked or not
    if (Object.values(gameConstants_1.PlayerMove).includes(input.action)) {
        resolve(input);
    }
    else {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: input.action + " is not a valid move" });
        input.processedData.errorData = ed;
        reject(input);
    }
});
let validateEnoughChips = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    let player = input.processedData.player;
    let considerAmount = Math.trunc(player.initialBet / 2);
    //will include this check for safe side also &&player.isInsuranceAsked in if block
    if (player.chips < considerAmount && input.isInsurancePlaced) {
        const errorData = { success: false, info: "Not enough Money to place Insurance", playerId: input.playerId };
        input.processedData.errorData = errorData;
        reject(input);
    }
    else {
        resolve(input);
    }
}));
let validateProfileAmount = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // logger.info("validateProfileAmount--", input)
    let payload = {
        tableId: input.tableId,
        chips: input.processedData.data.amount,
        playerId: input.playerId,
        player: input.processedData.player
    };
    if (input.isInsurancePlaced) {
        let deductTableChipsResponse = deductTableChips(payload);
        if (deductTableChipsResponse.success) {
            input.processedData.data.deductTableChipsResponse = deductTableChipsResponse;
            input.processedData.player = deductTableChipsResponse.player;
            input.processedData.player.hasPlacedInsurance = true;
            input.processedData.player.insuranceActionTaken = true;
            //will changes it's schema later will include both the bets in single object
            input.processedData.table.currentInfo.players[input.processedData.data.index] = input.processedData.player;
            input.processedData.table.currentInfo.isInsurancePlacedOnTable = true;
            resolve(input);
        }
        else {
            input.processedData.errorData = deductTableChipsResponse;
            // logger.info("validateProfileAmount errorData", input)
            //unlock table forceFully
            reject(input);
            // return
        }
    }
    else {
        input.processedData.player.hasPlacedInsurance = false;
        input.processedData.player.isInsuranceAsked = false;
        input.processedData.player.insuranceActionTaken = true;
        input.processedData.player.sideBet = 0;
        input.processedData.player.history.push({
            type: gameConstants_1.PlayerMove.Insurance,
            card: [],
            amount: 0,
            isInurancePlace: input.isInsurancePlaced
        });
        input.processedData.table.currentInfo.players[input.processedData.data.index] = input.processedData.player;
        //only change it's player Status that Insurance is not placed
        resolve(input);
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
        player.sideBet = chips;
        player.totalBetOnTable += chips;
        player.history.push({
            type: gameConstants_1.PlayerMove.Insurance,
            card: [],
            amount: chips,
            isInurancePlace: input.isInsurancePlaced
        });
        //playerState Broadcast for Ready and applied chips
        return { success: true, info: "player has place SideBets For Insurance", player: player };
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
;
