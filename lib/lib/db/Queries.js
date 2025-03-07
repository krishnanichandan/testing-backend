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
exports.updateTableDataAndUnlock = exports.updateTimeInTable = exports.removePlayerJoin = exports.findSpectatorPlayerOnTableJoinRecord = exports.updatePlayerSpectatorData = exports.upsertPlayerJoin = exports.findInGamePlayerData = exports.updateTableSettingsInDb = exports.updateTableJoinSettingsInDb = exports.findPlayerOnAlreadyTableJoinRecord = exports.findPlayerOnTableJoinRecord = exports.forceUnlockTable = exports.createTable = exports.findAvailableTable = exports.getTemplates = exports.replaceTable = exports.fetchTable = exports.checkTable = void 0;
const DbManager_1 = require("./DbManager");
function checkTable(tableId) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        // const table = await tableCollection.findOneAndUpdate({ id: tableId, "currentInfo.isOperationOn": false }, { $set: { "currentInfo.isOperationOn": false, actionName: processName, "currentInfo.operationStartTime": Number(new Date()) }, $inc: { "currentInfo._v": 1 } });
        const table = yield tableCollection.findOne({ id: tableId });
        return table; //alert might be returning old value rather than updated value
    });
}
exports.checkTable = checkTable;
;
function fetchTable(tableId, processName = "unknown") {
    return __awaiter(this, void 0, void 0, function* () {
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        // const table = await tableCollection.findOneAndUpdate({ id: tableId, "currentInfo.isOperationOn": false }, { $set: { "currentInfo.isOperationOn": false, actionName: processName, "currentInfo.operationStartTime": Number(new Date()) }, $inc: { "currentInfo._v": 1 } });
        const table = yield tableCollection.findOneAndUpdate({ id: tableId }, { $set: { "isOperationOn": false, "actionName": processName, "operationStartTime": Number(new Date()) }, $inc: { "_v": 1 } }, { returnDocument: "after" });
        return table.value; //alert might be returning old value rather than updated value
    });
}
exports.fetchTable = fetchTable;
;
function replaceTable(table, processName = "unknown") {
    return __awaiter(this, void 0, void 0, function* () {
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        table.currentInfo.isOperationOn = false;
        table.currentInfo._v--;
        const tableResult = yield tableCollection.findOneAndReplace({ id: table.id }, table, { returnDocument: "after" });
        return tableResult.value;
    });
}
exports.replaceTable = replaceTable;
;
function getTemplates(query = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        query.isActive = true;
        const templatCollection = DbManager_1.DbManager.Instance.masterDb.collection("templates");
        const template = yield templatCollection.findOne(query);
        template.id = template._id.toString();
        return template;
    });
}
exports.getTemplates = getTemplates;
function findAvailableTable(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        const table = yield tableCollection.findOne(query);
        return table;
    });
}
exports.findAvailableTable = findAvailableTable;
function createTable(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        const insertTableResult = yield tableCollection.insertOne(data);
        if (insertTableResult.acknowledged) {
            const table = yield tableCollection.findOne(insertTableResult.insertedId);
            return table;
        }
    });
}
exports.createTable = createTable;
function forceUnlockTable(tableId, processName = "unknown") {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Locker remove lock - force");
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        const tableResult = yield tableCollection.findOneAndUpdate({ id: tableId }, { $set: { "currentInfo.isOperationOn": false } });
        return tableResult.value;
    });
}
exports.forceUnlockTable = forceUnlockTable;
;
function findPlayerOnTableJoinRecord(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.findOne(query);
        return result;
    });
}
exports.findPlayerOnTableJoinRecord = findPlayerOnTableJoinRecord;
;
function findPlayerOnAlreadyTableJoinRecord(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.findOne(query);
        return result;
    });
}
exports.findPlayerOnAlreadyTableJoinRecord = findPlayerOnAlreadyTableJoinRecord;
;
function updateTableJoinSettingsInDb(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.updateOne({ tableId: data.tableId, playerId: data.playerId }, { $set: { settings: data.settings } });
        return result;
    });
}
exports.updateTableJoinSettingsInDb = updateTableJoinSettingsInDb;
;
function updateTableSettingsInDb(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        const result = yield tableJoinCollection.updateOne(data.filter, data.updateObj);
        return result;
    });
}
exports.updateTableSettingsInDb = updateTableSettingsInDb;
;
function findInGamePlayerData(query, project = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        const result = yield tableJoinCollection.findOne(query);
        return result;
    });
}
exports.findInGamePlayerData = findInGamePlayerData;
;
function upsertPlayerJoin(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.updateOne({ tableId: data.tableId, playerId: data.playerId }, { $setOnInsert: { playerName: data.playerName, firstJoined: new Date().toISOString(), observerSince: new Date().toISOString(), settings: data.settings, chipsIn: data.chipsIn, game_timeOut_min: data.game_timeOut_min, isSpectator: data.isSpectator }, $set: { networkIp: "later" } }, { upsert: true });
        return result;
    });
}
exports.upsertPlayerJoin = upsertPlayerJoin;
;
function updatePlayerSpectatorData(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.updateOne({ tableId: data.tableId, playerId: data.playerId }, { $set: { isSpectator: data.isSpectator } });
        return result;
    });
}
exports.updatePlayerSpectatorData = updatePlayerSpectatorData;
;
function findSpectatorPlayerOnTableJoinRecord(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.find(query).toArray();
        return result;
    });
}
exports.findSpectatorPlayerOnTableJoinRecord = findSpectatorPlayerOnTableJoinRecord;
;
function removePlayerJoin(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tablejoinrecord");
        const result = yield tableJoinCollection.deleteOne({ tableId: data.tableId, playerId: data.playerId });
        return result;
    });
}
exports.removePlayerJoin = removePlayerJoin;
;
function updateTimeInTable(tableId, finishTimeAt) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        yield tableCollection.updateOne({ id: tableId }, { $set: { 'currentInfo.turnTimeStartAt': Date.now(), 'currentInfo.finishTurnTimeAt': new Date(Date.now() + finishTimeAt * 1000).getTime() } });
    });
}
exports.updateTimeInTable = updateTimeInTable;
;
function updateTableDataAndUnlock(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const tableJoinCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        const result = yield tableJoinCollection.updateOne(data.filter, data.updateObj);
        return result;
    });
}
exports.updateTableDataAndUnlock = updateTableDataAndUnlock;
;
