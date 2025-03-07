import { assign } from "underscore";
import { fetchTable } from "../../../db/Queries";
import { DbManager } from "../../../db/DbManager";
import { Table } from "../../../dataFormats/table";
import { LinkedList } from "./ll";

let tasks: any = {};

class Deferred {
    promise: Promise<unknown>;
    reject: (reason?: any) => void;
    resolve: (value: unknown) => void;
    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

export async function getTable(tableId: string, actionName: string): Promise<Table | null> {
    let deferredInstance = new Deferred();
    tasks[tableId] = tasks[tableId] || new (LinkedList as any)();
    tasks[tableId].push({ params: { tableId, actionName }, deferred: deferredInstance });
    if (tasks[tableId].length <= 1) {
        doFirstTask(tasks[tableId]);
    }
    let res: any = await deferredInstance.promise;
    return res;
}

async function doFirstTask(list: any) {
    var task = list.firstElm();
    if (task) {
        let result = await runTask(task.params);
        if (!!result) {
            task.deferred.resolve(result);
        } else {
            task.deferred.reject();
        }
        list.shift();
        if (list.length > 0) {
            doFirstTask(list);
        }
    }
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//task is to simply fetch table with lock
async function runTask(params: { tableId: string, actionName: string }) {
    let attempts = 20;
    let interval = 100;
    //todos: increase attempts or make sure internal processes never fails or timeouts
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    while (attempts > 0) {
        const table = await tableCollection.findOneAndUpdate({ id: params.tableId, "currentInfo.isOperationOn": false }, { $set: { "currentInfo.isOperationOn": true, "currentInfo.actionName": params.actionName, "currentInfo.operationStartTime": Number(new Date()) }, $inc: { "currentInfo._v": 1 } }, { returnDocument: "after" });
        if (!!table.value) {
            console.log("Locker put lock - ", params.actionName);
            return table.value;
        } else {
            attempts--;
            await delay(interval);
        }
    }
    return null;
}