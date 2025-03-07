import * as LockerHelper from './LockTable/LockerHelper';

import { GameState, PlayerState } from "./types";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { checkTable, fetchTable, findPlayerOnTableJoinRecord, forceUnlockTable, replaceTable, updateTableDataAndUnlock, upsertPlayerJoin } from "../../db/Queries";

import { DbManager } from "../../db/DbManager";
import { Player } from "../../dataFormats/player";
import { Table } from "../../dataFormats/table";
import { dispatchPlayerStateBroadcast } from "./broadcaster";
import { findUser } from "../../db/masterQueries";
import { matchMaker } from "colyseus";
import { tableJoinResponseData } from "../../dataFormats/ClientDataFormat.ts/ResponseMaker";

type JoinTablePayload = {
    tableId?: string;
    playerId: string;
    playerName?: string;
    tableType?: string;
    password?: string;
    networkIp?: string;
    deviceType?: string;//find on backend

    processedData?: ProcessingData;
}

type ProcessingData = {
    errorData?: { success: boolean; tableId?: string; info: string; information?: any };
    data: {
        spectatorPlayer: any[];
        chipsIn: number;
        game_timeOut_min: any;
        // playerPlaySession?: number;
        settings: any,
        tableFound: boolean,
        isFirstJoin: boolean
    },
    table: Table,
    returnData?: {
        tableJoinResponse: any
    }
}

// Export the processJoin function which handles a player's request to join a table
export async function processJoin(data: JoinTablePayload) {
    console.log("process Join called", data)
// Define an array of tasks to be executed in sequence as part of the join process
    let arr = [initData, validatePayloadTask, getTableDataFromDb, addPlayerAsSpectatorToDb, updatePlayerStateIfSeated, makeClientResponseFormat, startIdleTimer];
    let pipeline = (new Pipeline<JoinTablePayload>());
// Pipe each task into the pipeline to be executed sequentially
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    })

    let catchedError: JoinTablePayload = null;

// Run the pipeline with the provided data and handle any errors that occur
    let result: JoinTablePayload | void = await pipeline.run(data).catch((e: JoinTablePayload) => {
        console.log(e);
        catchedError = e;
    });
 // If the pipeline executed successfully and returned a result

    if (!!result) {
        console.log("processJoin result->", JSON.stringify(result));
        if (result.processedData?.errorData && !result.processedData?.errorData?.success) {
            let toReturn = result.processedData?.errorData;
            return toReturn;
        }
        let toReturn = { success: true, response: result.processedData.returnData.tableJoinResponse };
        return toReturn;
    } else {
        console.log("processJoin Error->", result)
        let toReturn = catchedError.processedData.errorData;
        return toReturn;
    }
}






let initData = new Task<JoinTablePayload>((input: JoinTablePayload, resolve, reject) => {
    input.processedData = {
        data: { settings: {}, tableFound: false, isFirstJoin: true, chipsIn: 0, game_timeOut_min: 25, spectatorPlayer: [] },
        table: null
    }
    resolve(input);
});

let validatePayloadTask = new Task<JoinTablePayload>((input: JoinTablePayload, resolve, reject) => {
    if (!!input.tableId && !!input.playerId) {
        resolve(input);
    } else {
        let errorData = { success: false, tableId: (input.tableId || ""), info: "Key id or playerId not found or contains blank value!" };
        input.processedData.errorData = errorData;
        reject(input);
    }
});

let getTableDataFromDb = new Task<JoinTablePayload>(async (input: JoinTablePayload, resolve, reject) => {

    let table = await LockerHelper.getTable(input.tableId, "JoinProcess").catch(e => { console.log("fetch table error", e) });
    if (!table) {
        input.processedData.errorData = { success: false, information: "Table not found for this id", info: "No active tables found. Please, try again!" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
});


let addPlayerAsSpectatorToDb = new Task<JoinTablePayload>(async (input: JoinTablePayload, resolve, reject) => {

    //manage table settings too
    let playerRecord = await findPlayerOnTableJoinRecord({ tableId: input.tableId, playerId: input.playerId });
    if (!!playerRecord) {
        input.processedData.data.settings = playerRecord.settings;
        input.processedData.data.game_timeOut_min = playerRecord.game_timeOut_min;
        input.processedData.data.isFirstJoin = false;
        input.processedData.data.chipsIn = playerRecord.chipsIn;
    } else {
        let player: any = {};
        player.playerId = input.playerId;
        let playerResult: Player | void = await findUser({ playerId: input.playerId }).catch((e) => {
            console.log("find user error ", e)
        });
        if (!playerResult) {
            input.processedData.errorData = ({ success: false, info: "Something went wrong in fetching user" });
            reject(input);
            return;
        }
        input.processedData.data.settings = playerResult.preferences;
        input.processedData.data.chipsIn = playerResult.accountInfo.realChips;
        input.processedData.data.game_timeOut_min = playerResult.loginInfo.game_timeout_min;
        // input.processedData.data.playerPlaySession = playerResult.activityInfo.sessionStartedAt;

        let result = await upsertPlayerJoin({ tableId: input.tableId, playerName: input.playerName, playerId: input.playerId, settings: input.processedData.data.settings, chipsIn: input.processedData.data.chipsIn, game_timeOut_min: input.processedData.data.game_timeOut_min, isSpectator: true })
    }
    //also upsert table join record
    
    resolve(input);
});



// Change PLAYING if player is in same game from where disconnected
// Change ONBREAK if player is not in same game from where disconnected
// to Do
let updatePlayerStateIfSeated = new Task<JoinTablePayload>(async (input: JoinTablePayload, resolve, reject) => {
    //todos 
   
    let table = input.processedData.table;
    let playerIndexOnTable = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    
    if (playerIndexOnTable >= 0) {
       
        table = input.processedData.table;
        let currentPlayerIndex = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
        let previousState: any = null;
        let currentState = '';
        if (currentPlayerIndex >= 0) {
            let player = table.currentInfo.players[currentPlayerIndex];
            if (player.state !== PlayerState.Disconnected) {
                //, 'Player is not in DISCONNECTED state, so skipping player state update!');
                
            } 
            else if (player.roundId !== table.currentInfo.roundId) {
                // Change ONBREAK if player is not in same game from where disconnected
                //, 'Player is in DISCONNECTED state, but not in current game, setting state ONBREAK!');
                previousState = table.currentInfo.players[currentPlayerIndex].state;
                table.currentInfo.players[currentPlayerIndex].state = PlayerState.Waiting;
                currentState = PlayerState.Waiting;
               
            } 
            else {
                previousState = table.currentInfo.players[currentPlayerIndex].state;
                // Change player State based on game State and player
                // previous state if player is in same game from where disconnected
                // 'Player is in DISCONNECTED state, and in current game, setting state PLAYING!');
                const playerPreviousStateBeforeDiconnection = table.currentInfo.players[currentPlayerIndex].previousState;
                if (table.currentInfo.state === GameState.Betting) {
                    if (playerPreviousStateBeforeDiconnection === PlayerState.Waiting) {
                        table.currentInfo.players[currentPlayerIndex].state = PlayerState.Waiting;
                        currentState = PlayerState.Waiting;
                    } else if (playerPreviousStateBeforeDiconnection === PlayerState.Betting) {
                        //it may arise conflict
                        table.currentInfo.players[currentPlayerIndex].state = PlayerState.Betting;
                        currentState = PlayerState.Betting;
                    } else if (playerPreviousStateBeforeDiconnection === PlayerState.Ready) {
                        table.currentInfo.players[currentPlayerIndex].state = PlayerState.Ready;
                        currentState = PlayerState.Ready;
                    }
                }
    
                else if (table.currentInfo.state === GameState.Running) {
                    // may arise conflict if player just went disconnected after hitting ready State
                    table.currentInfo.players[currentPlayerIndex].state = [PlayerState.Waiting, PlayerState.Playing].includes(table.currentInfo.players[currentPlayerIndex].previousState as PlayerState) ? table.currentInfo.players[currentPlayerIndex].previousState : PlayerState.Waiting;
                    currentState = [PlayerState.Waiting, PlayerState.Playing].includes(table.currentInfo.players[currentPlayerIndex].previousState as PlayerState) ? table.currentInfo.players[currentPlayerIndex].previousState : PlayerState.Waiting;;
                }
            }
        }
        

        if (previousState === PlayerState.Disconnected) {
           
            try {
                let room = matchMaker.getRoomById(table.id);
                if (!!room) {
                    console.log("player Reconected-> ",{ tableId: table.id, playerId: input.playerId, playerState: table.currentInfo.players[currentPlayerIndex].state ,playerName:table.currentInfo.players[currentPlayerIndex].playerName})
                    dispatchPlayerStateBroadcast(room, { tableId: table.id, playerId: input.playerId, playerState: table.currentInfo.players[currentPlayerIndex].state });
                    let query = {
                        id: table.id,
                        'currentInfo.players': {
                            $elemMatch: {
                                playerId: input.playerId
                            }
                        }
                    }
                    let updateField = {
                        $set: {
                            "currentInfo.players.$.state": currentState,
                            "currentInfo.isOperationOn": false
                        }
                    }
                    let table3 = await updateTableDataAndUnlock({ filter: query, updateObj: updateField });
                }else{
                    await forceUnlockTable(input.tableId);
                }
            } catch (e) {
                console.log(e);
            }
           
        } else {
            console.log("Reconnection but not in Disconnected State->", { playerId: input.playerId });
            await forceUnlockTable(input.tableId)
           
    
    
        }
    }else{
        await forceUnlockTable(input.tableId)
    }

    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.find({ tableId: input.tableId, isSpectator: true }).toArray();
    let spectatorPlayer: any[] = [];
    result && result.forEach((player) => {
        spectatorPlayer.push(player.playerId)
    })
    input.processedData.data.spectatorPlayer = spectatorPlayer
    resolve(input);
});


let makeClientResponseFormat = new Task<JoinTablePayload>((input: JoinTablePayload, resolve, reject) => {
    //todos 
    let data = {
        settings: input.processedData.data.settings,
        previousState: "",//todos  to be set in updatePlayerStateIfSeated
    }

    let tableJoinResponse = tableJoinResponseData(input.processedData.table, input.playerId, data);
    console.log("Client response->",JSON.stringify(tableJoinResponse))
    input.processedData.returnData = {
        tableJoinResponse: { ...tableJoinResponse, spectator: input.processedData.data.spectatorPlayer }
    }
    resolve(input);
});

// ### Start timer to kick player from lobby only if player is not already sitted in NORMAL games

let startIdleTimer = new Task<JoinTablePayload>((input: JoinTablePayload, resolve, reject) => {
    let table = input.processedData.table;
    let playerIndexOnTable = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    if (playerIndexOnTable < 0) {
       
    }
    resolve(input);
});
