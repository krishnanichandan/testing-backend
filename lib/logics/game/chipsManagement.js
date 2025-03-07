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
exports.getUserChips = exports.deductChips = exports.addChips = void 0;
const masterQueries_1 = require("../../db/masterQueries");
function addChips(input) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("addChips--",input)
        // console.log("params are in addChips - " + JSON.stringify(params));
        input.tableId = !!input.tableId ? input.tableId : "";
        input.chips = Math.round(input.chips);
        if (input.instantBonusAmount > 0) {
            if (input.chips >= input.instantBonusAmount) {
                input.chips = Math.round(input.chips - input.instantBonusAmount);
                input.instantBonusAmount = Math.round(input.instantBonusAmount);
            }
            else {
                input.instantBonusAmount = Math.round(input.chips);
                input.chips = 0;
            }
        }
        let findUserError = null;
        //integrateDb later
        let player = yield (0, masterQueries_1.findUser)({ playerId: input.playerId }).catch((e) => {
            findUserError = e;
        });
        if (!!findUserError) {
            findUserError.errorData = { success: false, info: "Unable to add chips, user not found. Player id" };
            return findUserError;
        }
        if (!!player) {
            if (input.isRealMoney) {
                input.prevBalForPassbook = player.accountInfo.realChips + player.accountInfo.instantBonusAmount;
                let res = yield addRealChipsOfUser(input, player);
                res.previousBal = player.accountInfo.realChips + player.accountInfo.instantBonusAmount;
                return res;
            }
            else {
                let res = yield addFreeChipsOfUser(input, player);
                return res;
            }
        }
    });
}
exports.addChips = addChips;
;
function addRealChipsOfUser(input, player) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("addRealChipsOfUser--",input)
        function passBookEntryLeave(input, newAmount) {
            return __awaiter(this, void 0, void 0, function* () {
                let query = { playerId: input.playerId };
                let data = {};
                data.time = Number(new Date());
                data.category = input.category;
                data.prevAmt = input.prevBalForPassbook;
                if (input.instantBonusAmount) {
                    data.amount = input.chips + input.instantBonusAmount;
                }
                else {
                    data.amount = input.chips;
                }
                data.newAmt = newAmount;
                if (input.tableName) {
                    data.subCategory = "Leave";
                    data.tableName = input.tableName;
                }
                return false;
            });
        }
        ;
        //will intergrate Db later
        let result = yield (0, masterQueries_1.addRealChips)({ playerId: input.playerId, instantBonusAmount: input.instantBonusAmount || 0 }, input.chips).catch(e => { console.log("add chips db error", e); });
        if (!!result) {
            let newBalance = result.accountInfo.realChips + result.accountInfo.instantBonusAmount;
            yield passBookEntryLeave(input, newBalance);
            return ({ success: true, newBalance: newBalance });
        }
        else {
            return { success: false, tableId: input.tableId, info: "addChips failed!" };
        }
    });
}
function addFreeChipsOfUser(input, player) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("addFreeChipsOfUser--",input)
        //will add this later
        let result = yield (0, masterQueries_1.addFreeChips)({ playerId: input.playerId }, input.chips).catch(e => { console.log("add chips db error", e); });
        if (!!result) {
            return ({ success: true, newBalance: result.accountInfo.playChips });
        }
        else {
            return { success: false, tableId: input.tableId, info: "addChips failed!" };
        }
    });
}
function deductChips(input) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("deductChips--",input)
        input.tableId = input.tableId || "";
        input.chips = Math.round(input.chips);
        let findUserError = null;
        //will integrate Db later
        let player = yield (0, masterQueries_1.findUser)({ playerId: input.playerId }).catch((e) => {
            findUserError = e;
        });
        if (!!findUserError) {
            findUserError.errorData = { success: false, info: "Unable to deduct chips, user not found. Player id" };
            return { success: false, info: "Unable to deduct chips, user not found. Player id" };
            ;
        }
        if (!!player) {
            input.chips = input.isRealMoney ? player.accountInfo.realChips : player.accountInfo.playChips;
            if (input.isRealMoney) {
                // input.realChips = player.accountInfo.realChips;
                // input.instantBonusAmount = player.instantBonusAmount;
                let res = yield deductRealChipsOfUser(input, player);
                res.playerData = player;
                return res;
            }
            else {
                let res = yield deductFreeChipsOfUser(input, player);
                res.playerData = player;
                return res;
            }
        }
        else {
            return { success: false, tableId: input.tableId, info: "deduct Chips failed! Player." };
        }
    });
}
exports.deductChips = deductChips;
function deductRealChipsOfUser(input, player) {
    return __awaiter(this, void 0, void 0, function* () {
        if (player.accountInfo.realChips >= input.chips) {
            //deduct from real chips
            //will intergarte Db later
            let result = yield (0, masterQueries_1.deductRealChips)({ playerId: input.playerId }, input.chips).catch(e => { });
            if (!result) {
                return { success: false, tableId: input.tableId, info: "Deduct chips failed!" };
            }
            let newAmtBal = result.accountInfo.realChips + result.accountInfo.instantBonusAmount;
            return ({ success: true, realChips: result.accountInfo.realChips, playChips: result.accountInfo.playChips, instantBonusAmount: 0 });
        }
        else {
            if (player.accountInfo.instantBonusAmount >= (input.chips - player.accountInfo.realChips)) {
                let bonusDeduct = input.chips - player.accountInfo.realChips;
                let result = yield (0, masterQueries_1.deductRealChips)({ playerId: input.playerId }, input.chips, bonusDeduct).catch(e => { });
                if (!result) {
                    return { success: false, tableId: input.tableId, info: "Deduct chips failed 2!" };
                }
                let newAmtBal = result.accountInfo.realChips + result.accountInfo.instantBonusAmount;
                return ({ success: true, realChips: result.accountInfo.realChips, playChips: result.accountInfo.playChips, instantBonusAmount: bonusDeduct });
            }
            else {
                return ({ success: false, tableId: input.tableId, info: "You have insufficient balance to play. Please, Buy Tusks" });
            }
        }
    });
}
;
function deductFreeChipsOfUser(input, player) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("deductFreeChipsOfUser--",input)
        if (input.chips <= player.accountInfo.playChips) {
            let result = yield (0, masterQueries_1.deductFreeChips)({ playerId: input.playerId }, input.chips).catch(e => {
            });
            if (!result) {
                return { success: false, tableId: input.tableId, info: "Deduct chips failed!" };
            }
            return ({ success: true, realChips: result.accountInfo.realChips, playChips: result.accountInfo.playChips });
        }
        else {
            return ({ success: false, tableId: input.tableId, info: "You have insufficient balance to play. Please, Buy Tusks" });
        }
    });
}
function getUserChips(params) {
    return __awaiter(this, void 0, void 0, function* () {
        // logger.info("getUserChips--",params)
        params.tableId = !!params.tableId ? params.tableId : "";
        params.chips = Math.floor(params.chips);
        let findUserError = null;
        let player = yield (0, masterQueries_1.findUser)({ playerId: params.playerId }).catch((e) => {
            findUserError = e;
        });
        if (!!findUserError) {
            return { success: false, info: "Unable to get user chips, user not found. Player id" };
        }
        if (!!player) {
            return ({ success: true, realChips: player.accountInfo.realChips, playChips: player.accountInfo.playChips });
        }
    });
}
exports.getUserChips = getUserChips;
