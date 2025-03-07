import { Table } from "../dataFormats/table";
import { Template } from "../dataFormats/template";
import { DbManager } from "./DbManager";


export async function checkTable(tableId: string): Promise<Table> {
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    // const table = await tableCollection.findOneAndUpdate({ id: tableId, "currentInfo.isOperationOn": false }, { $set: { "currentInfo.isOperationOn": false, actionName: processName, "currentInfo.operationStartTime": Number(new Date()) }, $inc: { "currentInfo._v": 1 } });
    const table = await tableCollection.findOne({ id: tableId });
    return table;//alert might be returning old value rather than updated value
};

export async function fetchTable(tableId: string, processName: string = "unknown"): Promise<Table> {
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    // const table = await tableCollection.findOneAndUpdate({ id: tableId, "currentInfo.isOperationOn": false }, { $set: { "currentInfo.isOperationOn": false, actionName: processName, "currentInfo.operationStartTime": Number(new Date()) }, $inc: { "currentInfo._v": 1 } });
    const table = await tableCollection.findOneAndUpdate({ id: tableId }, { $set: { "isOperationOn": false, "actionName": processName, "operationStartTime": Number(new Date()) }, $inc: { "_v": 1 } },{ returnDocument: "after" });
    return table.value;//alert might be returning old value rather than updated value
};

export async function replaceTable(table: Table, processName: string = "unknown"): Promise<Table> {
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    table.currentInfo.isOperationOn = false;
    table.currentInfo._v--;
    const tableResult = await tableCollection.findOneAndReplace({ id: table.id }, table, { returnDocument: "after" });
    return tableResult.value;
};

export async function getTemplates(query: any = {}): Promise<Template> {
    query.isActive = true;
    const templatCollection = DbManager.Instance.masterDb.collection<Template>("templates");
    const template: Template = await templatCollection.findOne(query);
    template.id = template._id.toString()
    return template;
}

export async function findAvailableTable(query: any): Promise<Table> {
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    const table: Table = await tableCollection.findOne(query);
    return table;
}

export async function createTable(data: Table): Promise<Table> {
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    const insertTableResult = await tableCollection.insertOne(data);
    if(insertTableResult.acknowledged){
        const table=await tableCollection.findOne(insertTableResult.insertedId);
        return table;
    }
    
}

export async function forceUnlockTable(tableId: string, processName: string = "unknown"): Promise<Table> {
    console.log("Locker remove lock - force");
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    const tableResult = await tableCollection.findOneAndUpdate({ id: tableId }, { $set: { "currentInfo.isOperationOn": false } })
    return tableResult.value;
};

export async function findPlayerOnTableJoinRecord(query: { tableId: string, playerId: string }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.findOne(query);
    return result;
};

export async function findPlayerOnAlreadyTableJoinRecord(query: { playerId: string }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.findOne(query);
    return result;
};

export async function updateTableJoinSettingsInDb(data: { tableId: string, playerId: string, settings: any }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.updateOne({ tableId: data.tableId, playerId: data.playerId }, { $set: {settings:data.settings} });
    return result;
};

export async function updateTableSettingsInDb(data: { filter:any, updateObj: any }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tables");
    const result = await tableJoinCollection.updateOne(data.filter, data.updateObj);
    return result;
};

export async function findInGamePlayerData(query: any, project: any={}): Promise<any> {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tables");
    const result = await tableJoinCollection.findOne(query);
    return result;
};

export async function upsertPlayerJoin(data: { tableId: string, playerId: string, playerName: string, settings: any, chipsIn: number, game_timeOut_min: number, isSpectator: boolean }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.updateOne({ tableId: data.tableId, playerId: data.playerId },
        { $setOnInsert: { playerName: data.playerName, firstJoined: new Date().toISOString(), observerSince: new Date().toISOString(), settings: data.settings, chipsIn: data.chipsIn, game_timeOut_min: data.game_timeOut_min, isSpectator: data.isSpectator }, $set: { networkIp: "later" } },
        { upsert: true });
    return result;
};


export async function updatePlayerSpectatorData(data: { tableId: string, playerId: string, isSpectator: boolean }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.updateOne({ tableId: data.tableId, playerId: data.playerId }, { $set: { isSpectator: data.isSpectator } });
    return result;
};

export async function findSpectatorPlayerOnTableJoinRecord(query: {playerId: string, isSpectator?: boolean }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.find(query).toArray();
    return result;
};

export async function removePlayerJoin(data: { tableId: string, playerId: string }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.deleteOne({ tableId: data.tableId, playerId: data.playerId })
    return result;
};

export async function updateTimeInTable(tableId: string, finishTimeAt?: number) {
    const tableCollection = DbManager.Instance.masterDb.collection<Table>("tables");
    await tableCollection.updateOne({ id: tableId }, { $set: { 'currentInfo.turnTimeStartAt': Date.now(), 'currentInfo.finishTurnTimeAt': new Date(Date.now() + finishTimeAt * 1000).getTime() } });
};

export async function updateTableDataAndUnlock(data: { filter:any, updateObj: any }) {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tables");
    const result = await tableJoinCollection.updateOne(data.filter, data.updateObj);
    return result;
};