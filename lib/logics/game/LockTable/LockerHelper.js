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
exports.getTable = void 0;
const DbManager_1 = require("../../../db/DbManager");
const ll_1 = require("./ll");
let tasks = {};
class Deferred {
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}
function getTable(tableId, actionName) {
    return __awaiter(this, void 0, void 0, function* () {
        let deferredInstance = new Deferred();
        tasks[tableId] = tasks[tableId] || new ll_1.LinkedList();
        tasks[tableId].push({ params: { tableId, actionName }, deferred: deferredInstance });
        if (tasks[tableId].length <= 1) {
            doFirstTask(tasks[tableId]);
        }
        let res = yield deferredInstance.promise;
        return res;
    });
}
exports.getTable = getTable;
function doFirstTask(list) {
    return __awaiter(this, void 0, void 0, function* () {
        var task = list.firstElm();
        if (task) {
            let result = yield runTask(task.params);
            if (!!result) {
                task.deferred.resolve(result);
            }
            else {
                task.deferred.reject();
            }
            list.shift();
            if (list.length > 0) {
                doFirstTask(list);
            }
        }
    });
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//task is to simply fetch table with lock
function runTask(params) {
    return __awaiter(this, void 0, void 0, function* () {
        let attempts = 20;
        let interval = 100;
        //todos: increase attempts or make sure internal processes never fails or timeouts
        const tableCollection = DbManager_1.DbManager.Instance.masterDb.collection("tables");
        while (attempts > 0) {
            const table = yield tableCollection.findOneAndUpdate({ id: params.tableId, "currentInfo.isOperationOn": false }, { $set: { "currentInfo.isOperationOn": true, "currentInfo.actionName": params.actionName, "currentInfo.operationStartTime": Number(new Date()) }, $inc: { "currentInfo._v": 1 } }, { returnDocument: "after" });
            if (!!table.value) {
                console.log("Locker put lock - ", params.actionName);
                return table.value;
            }
            else {
                attempts--;
                yield delay(interval);
            }
        }
        return null;
    });
}
