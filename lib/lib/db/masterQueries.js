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
exports.increaseUserStats = exports.addFreeChips = exports.addRealChips = exports.deductFreeChips = exports.deductRealChips = exports.findAndUpdateUser = exports.findUser = exports.updateUser = exports.signupUser = void 0;
const DbManager_1 = require("./DbManager");
//#region Entry
function signupUser(playerData) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.insertOne(playerData);
    });
}
exports.signupUser = signupUser;
//#endregion
//used for preferences and from updateprofilehelper.ts // also stats when leave table
function updateUser(filterObj, updateKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.updateOne(filterObj, { $set: updateKeys }, { upsert: true });
        return result;
    });
}
exports.updateUser = updateUser;
;
function findUser(filterObj) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.findOne(filterObj);
        return result;
    });
}
exports.findUser = findUser;
;
function findAndUpdateUser(filterObj, updateObj) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.findOneAndUpdate(filterObj, { $set: updateObj }, { returnDocument: "after" });
        return result.value;
    });
}
exports.findAndUpdateUser = findAndUpdateUser;
;
//#region ChipsUpdater queries
function deductRealChips(filter, chips, instantBonusAmount = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.realChips": -chips, "accountInfo.instantBonusAmount": -instantBonusAmount } }, { returnDocument: "after" });
        return result.value;
    });
}
exports.deductRealChips = deductRealChips;
;
function deductFreeChips(filter, chips) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.playChips": -chips } }, { returnDocument: "after" });
        return result.value;
    });
}
exports.deductFreeChips = deductFreeChips;
;
function addRealChips(filter, chips) {
    return __awaiter(this, void 0, void 0, function* () {
        let instantIBA = 0;
        if (filter.instantBonusAmount >= 0) {
            instantIBA = filter.instantBonusAmount;
            delete filter.instantBonusAmount;
        }
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.realChips": chips, "accountInfo.instantBonusAmount": instantIBA } }, { returnDocument: "after" });
        return result.value;
    });
}
exports.addRealChips = addRealChips;
function addFreeChips(filter, chips) {
    return __awaiter(this, void 0, void 0, function* () {
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        const result = yield usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.playChips": chips } }, { returnDocument: "after" });
        return result.value;
    });
}
exports.addFreeChips = addFreeChips;
function increaseUserStats(query, updateKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        // prepare a query for one or more players
        function getPlayerIdsQuery(obj) {
            if (obj.playerIds instanceof Array) {
                if (obj.playerIds.length <= 0) {
                    return false;
                }
                return { playerId: { $in: obj.playerIds } };
            }
            if (!obj.playerId) {
                return false;
            }
            return { playerId: obj.playerId };
        }
        const usersCollection = DbManager_1.DbManager.Instance.masterDb.collection("players");
        let usableQuery = getPlayerIdsQuery(query);
        if (!usableQuery) {
            console.log("query not valid");
            return;
        }
        const result = yield usersCollection.updateMany(usableQuery, { $inc: updateKeys });
        return result;
    });
}
exports.increaseUserStats = increaseUserStats;
;
