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
exports.processSit = void 0;
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const underscore_1 = require("underscore");
const InGamePlayer_1 = require("../../dataFormats/InGamePlayer");
const Queries_1 = require("../../db/Queries");
const startGameHelper_1 = require("./startGameHelper");
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const broadcaster_1 = require("./broadcaster");
const chipsManagement_1 = require("./chipsManagement");
const masterQueries_1 = require("../../db/masterQueries");
const SchedulerHelper_1 = require("./SchedulerHelper");
function processSit(data) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("processSit---", processSit)
        console.log("Process Sit is called", data);
        let arr = [initData, validatePayloadTask, getTableDataFromDb, isPlayerNotOnTable, validateBuyInAllowed,
            validateSeatOccupancy, validateProfileAmount, pushPlayerWithWaitingState, broadcastLobbyDetails, logandCheckGameStart];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        let result = yield pipeline.run(data).catch((e) => {
            // logger.info("processSit error", { data: data }, { error: e })
            console.log(e);
            catchedError = e;
        });
        if (!!result) {
            // console.log("sit response",JSON.stringify(result))
            let toReturn = { success: true, response: { tableId: data.tableId } };
            return toReturn;
        }
        else {
            if (!!catchedError.processedData.table) {
                yield (0, Queries_1.forceUnlockTable)(catchedError.processedData.table.id);
            }
            console.log("Sit error occur->", catchedError.processedData.errorData);
            let toReturn = catchedError.processedData.errorData;
            return toReturn;
        }
    });
}
exports.processSit = processSit;
let initData = new j_stillery_1.Task((input, resolve, reject) => {
    input.processedData = {
        data: { buyinCheckRequired: true },
        table: null
    };
    resolve(input);
});
let validatePayloadTask = new j_stillery_1.Task((input, resolve, reject) => {
    // logger.info("validatePayloadTask---", validatePayloadTask)
    if (!!input.tableId && !!input.playerId) {
        // logger.info("validatePayloadTask executed successffully", { playerId: input.playerId })
        resolve(input);
    }
    else {
        let errorData = { success: false, isRetry: false, isDisplay: false, id: (input.tableId || ""), info: "Key id or playerId not found or contains blank value!" };
        // logger.info("validatePayloadTask errorData", { errorData: errorData })
        input.processedData.errorData = errorData;
        reject(input);
    }
});
let getTableDataFromDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // logger.info("getTableDataFromDb---", input)
    // let table = await fetchTable(input.tableId).catch(e => { });
    let table = yield LockerHelper.getTable(input.tableId, "SitRequest").catch(e => { });
    if (!table) {
        input.processedData.errorData = { success: false, info: "No active tables found. Please, try again!" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
}));
let isPlayerNotOnTable = new j_stillery_1.Task((input, resolve, reject) => {
    // logger.info("isPlayerNotOnTable---", input)
    let table = input.processedData.table;
    if (table.currentInfo.players.length !== 3) { //check for single table Player
        if (table.currentInfo.players.findIndex((player) => player.playerId === input.playerId) < 0) {
            // logger.info("isPlayerNotOnTable executed succesfully", input)
            resolve(input);
        }
        else {
            let errorData = ({ success: false, tableId: (input.tableId || ""), info: "Player already on table!" });
            input.processedData.errorData = errorData;
            // logger.info("isPlayerNotOnTable err", { info: "Player already on table!" })
            reject(input);
        }
    }
    else {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "All seats are full on the table !" });
        // logger.info("isPlayerNotOnTable err", { errorData: errorData, info: "All seats are full on the table !" })
        //redirect him to find available table and join their as spectator to Do
        input.processedData.errorData = errorData;
        reject(input);
    }
});
let validateBuyInAllowed = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // Do not check buy in range if already checked in anti banking
    //  todos if(!params.data.buyinCheckRequired) {
    //}
    // logger.info("validateBuyInAllowed--called", input)
    let findUserError = null;
    let player = yield (0, masterQueries_1.findUser)({ playerId: input.playerId }).catch((e) => {
        findUserError = e;
    });
    if (!!findUserError) {
        let errorData = { success: false, info: "Unable to deduct chips, user not found. Player id" };
        input.processedData.errorData = errorData;
        reject(input);
    }
    input.processedData.player = player;
    let table = input.processedData.table;
    console.log("player sit request player chips:", { playerId: player.playerId, playerName: player.info.name, chips: player.accountInfo.realChips });
    input.chips = input.processedData.table.info.isRealMoney ? input.processedData.player.accountInfo.realChips : input.processedData.player.accountInfo.playChips;
    if (input.chips > 0 && input.chips >= Math.trunc(table.info.minBuyIn)) {
        // logger.info("validateBuyInAllowed--executed sucessfully", input)
        resolve(input);
    }
    else {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "You have insufficient balance to play. Please, Buy Tusks." });
        input.processedData.errorData = errorData;
        // logger.info("validateBuyInAllowed errorData", errorData)
        reject(input);
    }
    // resolve(input);
}));
let validateSeatOccupancy = new j_stillery_1.Task((input, resolve, reject) => {
    // logger.info("validateSeatOccupancy", input)
    let indexOccupied = (0, underscore_1.uniq)((0, underscore_1.pluck)(input.processedData.table.currentInfo.players, 'seatIndex'));
    if (input.seatIndex >= 0 && indexOccupied.indexOf(input.seatIndex) < 0) {
        resolve(input);
    }
    else {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "This seat is occupied. Please, choose another seat to play." });
        //to Do check other Seats if vacant just give Error
        //else redirect to other table
        input.processedData.errorData = errorData;
        reject(input);
    }
});
// Check if player has sufficient amount as requested in profile
let validateProfileAmount = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    // logger.info("validateProfileAmount--", input)
    let payload = {
        tableId: input.tableId,
        chips: input.chips,
        playerId: input.playerId,
        isRealMoney: input.processedData.table.info.isRealMoney ? true : false,
        subCategory: "Sit In"
    };
    let deductChipsResponse = yield (0, chipsManagement_1.deductChips)(payload);
    if (deductChipsResponse.success) {
        // logger.info("Player chips deducted successfully on sit request!")
        //.info,"Player chips deducted successfully on sit request!");
        // params.instantBonusUsed = true;
        if (!!deductChipsResponse.instantBonusAmount) {
            deductChipsResponse.instantBonusAmount = 0;
        }
        input.processedData.data.instantBonusAmount = deductChipsResponse.instantBonusAmount || 0;
        input.processedData.data.deductChipsResponse = deductChipsResponse;
        input.processedData.player = deductChipsResponse.playerData;
        // logger.info("validateProfileAmount success", input)
        resolve(input);
    }
    else {
        input.processedData.errorData = deductChipsResponse;
        // logger.info("validateProfileAmount errorData", input)
        reject(input);
    }
}));
let pushPlayerWithWaitingState = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = input.processedData.table;
    //if player's extra info is needed like hud details,stats etc ,can attach in prev step - validate profile amount.it fetches from db.
    let data = {
        playerId: input.playerId,
        tableId: input.tableId,
        chips: input.chips,
        seatIndex: input.seatIndex,
        playerName: input.playerName,
        avatar: input.avatar,
        networkIp: input.networkIp,
        deviceType: input.deviceType,
        instantBonusAmount: input.processedData.data.instantBonusAmount,
        isAutoRebuy: input.isAutoReBuy
    };
    let newInGamePlayer = (0, InGamePlayer_1.createInGamePlayer)(data, input.processedData.table.info.maxBuyIn, input.processedData.player);
    //*************************** */
    table.currentInfo.players.push(newInGamePlayer);
    table.currentInfo.vacantSeats = table.currentInfo.vacantSeats - 1;
    table.currentInfo.maxBettingCountOnTable = 1;
    const query = {
        id: table.id
    };
    let updateField = {
        $push: { "currentInfo.players": newInGamePlayer },
        $inc: { "currentInfo.vacantSeats": -1 },
        $set: {
            "currentInfo.maxBettingCountOnTable": 1,
            "currentInfo.isOperationOn": false
        }
    };
    let modTable = yield (0, Queries_1.updateTableDataAndUnlock)({ filter: query, updateObj: updateField });
    console.log(JSON.stringify(modTable));
    if (!modTable && !modTable.acknowledged && !modTable.modifiedCount) {
        let errorData = { success: false, info: "player couldnt be pushed in table db as waiting" };
        input.processedData.errorData = errorData;
        reject(input);
        return;
    }
    //info, 'Total players after this playerd added - ' + JSON.stringify(table.players));
    resolve(input);
}));
//player profile chips and lobby table update
let broadcastLobbyDetails = new j_stillery_1.Task((input, resolve, reject) => {
    //todos lobby table details;
    //todos proper data below:
    // logger.info("broadcastLobbyDetails--", input)
    let info = input.processedData.data.deductChipsResponse;
    let data = { playChips: info.playChips, realChips: info.realChips, instantBonusAmount: info.instantBonusAmount };
    input.client.send("Profile_Update", { playerId: input.playerId, data: data });
    let result = (0, Queries_1.updatePlayerSpectatorData)({ playerId: input.playerId, tableId: input.tableId, isSpectator: false });
    resolve(input);
});
let logandCheckGameStart = new j_stillery_1.Task((input, resolve, reject) => {
    // logger.info("logandCheckGameStart--", input)
    let index = input.processedData.table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    let player = input.processedData.table.currentInfo.players[index];
    // fireSitBroadcast to all in room
    // console.log(input.room)
    (0, broadcaster_1.dispatchPlayerSitBroadcast)(input.room, player);
    SchedulerHelper_1.SchedulerHelper.Instance.startPlayerPlaySession(input.tableId, input.playerId, player.playerGame_timeOut_min);
    if (input.processedData.table.currentInfo.players.length === 1) {
        setTimeout(function () {
            let data = { tableId: input.tableId, eventName: "SIT", room: input.room };
            (0, startGameHelper_1.processStartGame)(data);
        }, 100);
    }
    resolve(input);
});
