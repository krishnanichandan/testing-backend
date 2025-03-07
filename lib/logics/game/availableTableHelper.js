"use strict";
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
exports.findAvailableOrCreateRoom = void 0;
const colyseus_1 = require("colyseus");
const table_1 = require("../../dataFormats/table");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const Queries_1 = require("../../db/Queries");
const masterQueries_1 = require("../../db/masterQueries");
function findAvailableOrCreateRoom(data) {
    return __awaiter(this, void 0, void 0, function* () {
        let arr = [initData, validatePayloadTask, getAvailableTable,];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        let result = yield pipeline.run(data).catch((e) => {
            console.log(e);
            catchedError = e;
        });
        if (!!result) {
            data.processedData.response = {
                playerId: data.playerId,
                tableId: data.processedData.tableId,
                table: data.processedData.table,
                readyToJoin: data.processedData.readyToJoin
            };
            return { sucess: true, response: result.processedData.response };
        }
        else {
            return { sucess: false, errorData: "table Creation and fetch existing Table Error" };
        }
    });
}
exports.findAvailableOrCreateRoom = findAvailableOrCreateRoom;
let initData = new j_stillery_1.Task((input, resolve, reject) => {
    input.processedData = {};
    input.isSinglePlayerTable = input.isSinglePlayerTable || false;
    input.player = null;
    resolve(input);
});
let validatePayloadTask = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    if (!!input.playerId) {
        let player = yield (0, masterQueries_1.findUser)({ playerId: input.playerId });
        input.player = player;
        resolve(input);
    }
    else {
        let errorData = { success: false, info: "playerId not found or contains blank value!" };
        input.processedData.errorData = errorData;
        reject(input);
    }
}));
let getAvailableTable = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    //find player already joined Table also in Case of player Already Joined any Table
    let playerAlreadyJoinedTable = yield (0, Queries_1.findPlayerOnAlreadyTableJoinRecord)({ playerId: input.playerId });
    if (playerAlreadyJoinedTable) {
        input.processedData.tableId = playerAlreadyJoinedTable.tableId;
        let table = yield (0, Queries_1.fetchTable)(playerAlreadyJoinedTable.tableId);
        input.processedData.table = table;
        input.processedData.readyToJoin = true;
    }
    else {
        let query = {
            "info.isSinglePlayerTable": input.isSinglePlayerTable,
            "currentInfo.vacantSeats": input.isSinglePlayerTable ? { $eq: 1 } : { $lte: 3, $gt: 0 }
        };
        let table = yield (0, Queries_1.findAvailableTable)(query); //find One with available vacant Seat
        if (!!table) {
            // let rooms=await matchMaker.query({ name: "game" });
            let room = colyseus_1.matchMaker.getRoomById(table.id);
            input.processedData.room = room;
            input.processedData.table = table;
            input.processedData.tableId = table.id;
            input.processedData.readyToJoin = true;
        }
        else {
            //to Do find Template on Some query Based
            let template = yield (0, Queries_1.getTemplates)();
            let CreateTablePayload = template;
            CreateTablePayload = Object.assign(Object.assign({}, CreateTablePayload), { game_text1: ((_b = (_a = input === null || input === void 0 ? void 0 : input.player) === null || _a === void 0 ? void 0 : _a.additionalInfo) === null || _b === void 0 ? void 0 : _b.game_text1) || "", game_text2: ((_d = (_c = input === null || input === void 0 ? void 0 : input.player) === null || _c === void 0 ? void 0 : _c.additionalInfo) === null || _d === void 0 ? void 0 : _d.game_text2) || "", game_text3: ((_f = (_e = input === null || input === void 0 ? void 0 : input.player) === null || _e === void 0 ? void 0 : _e.additionalInfo) === null || _f === void 0 ? void 0 : _f.game_text3) || "", isSinglePlayerTable: input.isSinglePlayerTable, maxNoOfPlayers: input.isSinglePlayerTable ? 1 : 3 });
            let table = new table_1.Table(CreateTablePayload).getTable(); //pass template to create table
            const tableInsertResult = yield (0, Queries_1.createTable)(table);
            let payload = {};
            payload.playerId = input.playerId;
            payload.tableId = tableInsertResult.id;
            let room = yield colyseus_1.matchMaker.handleCreateRoom('game', { roomId: payload.tableId }, payload.tableId);
            room.roomId = payload.tableId;
            input.processedData.room = room;
            input.processedData.tableId = table.id;
            input.processedData.table = table;
            input.processedData.readyToJoin = true;
        }
    }
    resolve(input);
}));
