import { Client, Room, matchMaker } from "colyseus";
import { CreateTablePayload, Table } from "../../dataFormats/table";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { createTable, fetchTable, findAvailableTable, findPlayerOnAlreadyTableJoinRecord, getTemplates } from "../../db/Queries";

import { GameRoom } from "../../rooms/GameRoom";
import { Player } from "../../dataFormats/player";
import { findUser } from "../../db/masterQueries";

type findAvailableOrCreateRoom = {
    player?: any;
    room?: Room;
    playerId: string,
    client?: Client;
    processedData?: ProcessingData;
    isSinglePlayerTable: boolean;
}
type ProcessingData = {
    room: any;
    readyToJoin: boolean;
    errorData: { success: boolean; tableId?: any; info: string; };
    data?: {

    };
    response?: any;
    table?: Table,
    tableId: string
    player?: Player
}
export async function findAvailableOrCreateRoom(data: findAvailableOrCreateRoom) {

    let arr = [initData, validatePayloadTask, getAvailableTable,];
    let pipeline = (new Pipeline<findAvailableOrCreateRoom>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    })

    let catchedError: findAvailableOrCreateRoom = null;
    let result: findAvailableOrCreateRoom | void = await pipeline.run(data).catch((e: findAvailableOrCreateRoom) => {
        console.log(e);
        catchedError = e;
    });
    if (!!result) {
        data.processedData.response = {
            playerId: data.playerId,
            tableId: data.processedData.tableId,
            table: data.processedData.table,
            readyToJoin: data.processedData.readyToJoin
        }
        return { sucess: true, response: result.processedData.response };
    } else {
        return { sucess: false, errorData: "table Creation and fetch existing Table Error" }
    }
}

let initData = new Task<findAvailableOrCreateRoom>((input: findAvailableOrCreateRoom, resolve, reject) => {
    input.processedData = {} as ProcessingData;
    input.isSinglePlayerTable = input.isSinglePlayerTable || false;
    input.player = null;
    resolve(input)
});

let validatePayloadTask = new Task<findAvailableOrCreateRoom>(async (input: findAvailableOrCreateRoom, resolve, reject) => {
    if (!!input.playerId) {
        let player: Player = await findUser({ playerId: input.playerId });
        input.player = player as any
        resolve(input);
    } else {
        let errorData = { success: false, info: "playerId not found or contains blank value!" };
        input.processedData.errorData = errorData;
        reject(input);
    }
});

let getAvailableTable = new Task<findAvailableOrCreateRoom>(async (input: findAvailableOrCreateRoom, resolve, reject) => {
    //find player already joined Table also in Case of player Already Joined any Table
    let playerAlreadyJoinedTable = await findPlayerOnAlreadyTableJoinRecord({ playerId: input.playerId });
    if (playerAlreadyJoinedTable) {
        input.processedData.tableId = playerAlreadyJoinedTable.tableId;
        let table = await fetchTable(playerAlreadyJoinedTable.tableId);
        input.processedData.table = table;
        input.processedData.readyToJoin = true;
    } else {
        let query = {
            "info.isSinglePlayerTable": input.isSinglePlayerTable,
            "currentInfo.vacantSeats": input.isSinglePlayerTable ? { $eq: 1 } : { $lte: 3, $gt: 0 }
        }
        let table = await findAvailableTable(query)//find One with available vacant Seat

        if (!!table) {
            // let rooms=await matchMaker.query({ name: "game" });
            let room = matchMaker.getRoomById(table.id);
            input.processedData.room = room;
            input.processedData.table = table;
            input.processedData.tableId = table.id;
            input.processedData.readyToJoin = true;
        }
        else {
            //to Do find Template on Some query Based
            let template = await getTemplates();
            let CreateTablePayload = template as any
            CreateTablePayload = {
                ...CreateTablePayload,
                game_text1: input?.player?.additionalInfo?.game_text1 || "",
                game_text2: input?.player?.additionalInfo?.game_text2 || "",
                game_text3: input?.player?.additionalInfo?.game_text3 || "",
                isSinglePlayerTable: input.isSinglePlayerTable,
                maxNoOfPlayers: input.isSinglePlayerTable ? 1 : 3
            }
            let table = new Table(CreateTablePayload).getTable()//pass template to create table
            const tableInsertResult: any = await createTable(table);
            let payload: any = {}
            payload.playerId = input.playerId;
            payload.tableId = tableInsertResult.id;
            let room = await matchMaker.handleCreateRoom('game', { roomId: payload.tableId }, payload.tableId)

            room.roomId = payload.tableId
            input.processedData.room = room;
            input.processedData.tableId = table.id;
            input.processedData.table = table;
            input.processedData.readyToJoin = true;
        }
    }

    resolve(input);
});
