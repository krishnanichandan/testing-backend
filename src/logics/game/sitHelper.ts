import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { Client, Room, matchMaker } from "colyseus";
import { pluck, uniq } from "underscore";
import { createInGamePlayer, InGamePlayer } from "../../dataFormats/InGamePlayer"
import { fetchTable, forceUnlockTable, replaceTable, updatePlayerSpectatorData, updateTableDataAndUnlock } from "../../db/Queries";
import { Table } from "../../dataFormats/table";
import { Player } from "../../dataFormats/player";
import { processStartGame } from "./startGameHelper";
import * as LockerHelper from './LockTable/LockerHelper';
import { dispatchPlayerSitBroadcast } from "./broadcaster";
import { deductChips } from "./chipsManagement";
import { processDealMove } from "./PlayerDealHelper";
import { processGameOver } from "./gameOverHelper";
import { findUser } from "../../db/masterQueries";
import { SchedulerHelper } from "./SchedulerHelper";
// import * as LockerHelper from './LockTable/LockerHelper';


interface SitTablePayload {
    tableId: string;
    playerId: string;
    playerName: string;
    chips: number;
    seatIndex: number;
    isAutoReBuy: boolean;
    avatar: string;
    room: Room;
    client: Client;
    deviceType: string;
    networkIp?: string;
    processedData?: ProcessingData;
}

type ProcessingData = {
    errorData?: { success: boolean; tableId?: string; info: string; };
    data: {
        buyinCheckRequired: boolean;//true
        instantBonusAmount?: number;//value if and how much instantbonusamount deducted in this sit request.
        deductChipsResponse?: { success: boolean; realChips: number, playChips: number, instantBonusAmount: number }
    },
    table: Table,
    player?: any
}

export async function processSit(data: SitTablePayload) {
    // logger.info("processSit---", processSit)
    console.log("Process Sit is called", data);
    let arr: Task<SitTablePayload>[] = [initData, validatePayloadTask, getTableDataFromDb, isPlayerNotOnTable, validateBuyInAllowed,
        validateSeatOccupancy, validateProfileAmount, pushPlayerWithWaitingState, broadcastLobbyDetails, logandCheckGameStart];
    let pipeline = (new Pipeline<SitTablePayload>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });
    let catchedError: SitTablePayload = null;
    let result: SitTablePayload | void = await pipeline.run(data).catch((e: SitTablePayload) => {
        // logger.info("processSit error", { data: data }, { error: e })
        console.log(e);
        catchedError = e;
    });
    if (!!result) {
        // console.log("sit response",JSON.stringify(result))
        let toReturn = { success: true, response: { tableId: data.tableId } };
        return toReturn;
    } else {
        if (!!catchedError.processedData.table) {
            await forceUnlockTable(catchedError.processedData.table.id)
        }
        console.log("Sit error occur->", catchedError.processedData.errorData)
        let toReturn = catchedError.processedData.errorData;
        return toReturn;
    }
}

let initData = new Task<SitTablePayload>((input: SitTablePayload, resolve, reject) => {
    input.processedData = {
        data: {  buyinCheckRequired: true },
        table: null
    }
    resolve(input);
});


let validatePayloadTask = new Task<SitTablePayload>((input: SitTablePayload, resolve, reject) => {
    // logger.info("validatePayloadTask---", validatePayloadTask)
    if (!!input.tableId && !!input.playerId) {
        // logger.info("validatePayloadTask executed successffully", { playerId: input.playerId })
        resolve(input);
    } else {
        let errorData = { success: false, isRetry: false, isDisplay: false, id: (input.tableId || ""), info: "Key id or playerId not found or contains blank value!" };
        // logger.info("validatePayloadTask errorData", { errorData: errorData })
        input.processedData.errorData = errorData;
        reject(input);
    }
});

let getTableDataFromDb = new Task<SitTablePayload>(async (input: SitTablePayload, resolve, reject) => {
    // logger.info("getTableDataFromDb---", input)

    // let table = await fetchTable(input.tableId).catch(e => { });
    let table = await LockerHelper.getTable(input.tableId, "SitRequest").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "No active tables found. Please, try again!" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
});


let isPlayerNotOnTable = new Task<SitTablePayload>((input: SitTablePayload, resolve, reject) => {
    // logger.info("isPlayerNotOnTable---", input)

    let table = input.processedData.table;
    if (table.currentInfo.players.length !== 3) {//check for single table Player
        if (table.currentInfo.players.findIndex((player) => player.playerId === input.playerId) < 0) {
            // logger.info("isPlayerNotOnTable executed succesfully", input)
            resolve(input);
        } else {
            let errorData = ({ success: false, tableId: (input.tableId || ""), info: "Player already on table!" });
            input.processedData.errorData = errorData;
            // logger.info("isPlayerNotOnTable err", { info: "Player already on table!" })
            reject(input);
        }
    } else {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "All seats are full on the table !" });
        // logger.info("isPlayerNotOnTable err", { errorData: errorData, info: "All seats are full on the table !" })
        //redirect him to find available table and join their as spectator to Do
        input.processedData.errorData = errorData;
        reject(input);
    }
});


let validateBuyInAllowed = new Task<SitTablePayload>(async (input: SitTablePayload, resolve, reject) => {
    // Do not check buy in range if already checked in anti banking
    //  todos if(!params.data.buyinCheckRequired) {
    //}
    // logger.info("validateBuyInAllowed--called", input)
    let findUserError: any = null;
    let player: any = await findUser({ playerId: input.playerId }).catch((e) => {
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
    } else {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "You have insufficient balance to play. Please, Buy Tusks." });
        input.processedData.errorData = errorData;
        // logger.info("validateBuyInAllowed errorData", errorData)
        reject(input);
    }
    // resolve(input);
});

let validateSeatOccupancy = new Task<SitTablePayload>((input: SitTablePayload, resolve, reject) => {
    // logger.info("validateSeatOccupancy", input)
    let indexOccupied = uniq(pluck(input.processedData.table.currentInfo.players, 'seatIndex'));
    if (input.seatIndex >= 0 && indexOccupied.indexOf(input.seatIndex) < 0) {
        resolve(input);
    } else {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "This seat is occupied. Please, choose another seat to play." });
        //to Do check other Seats if vacant just give Error
        //else redirect to other table
        input.processedData.errorData = errorData;
        reject(input);
    }
});

// Check if player has sufficient amount as requested in profile
let validateProfileAmount = new Task<SitTablePayload>(async (input: SitTablePayload, resolve, reject) => {
    // logger.info("validateProfileAmount--", input)
    let payload = {
        tableId: input.tableId,
        chips: input.chips,
        playerId: input.playerId,
        isRealMoney: input.processedData.table.info.isRealMoney ? true : false,
        subCategory: "Sit In"
    }
    let deductChipsResponse = await deductChips(payload);
    if (deductChipsResponse.success) {
        // logger.info("Player chips deducted successfully on sit request!")
        //.info,"Player chips deducted successfully on sit request!");
        // params.instantBonusUsed = true;
        if (!!deductChipsResponse.instantBonusAmount) {
            deductChipsResponse.instantBonusAmount = 0
        }
        input.processedData.data.instantBonusAmount = deductChipsResponse.instantBonusAmount || 0;
        input.processedData.data.deductChipsResponse = deductChipsResponse;
        input.processedData.player = deductChipsResponse.playerData;
        // logger.info("validateProfileAmount success", input)
        resolve(input);
    } else {
        input.processedData.errorData = deductChipsResponse;
        // logger.info("validateProfileAmount errorData", input)
        reject(input);
    }
});

let pushPlayerWithWaitingState = new Task<SitTablePayload>(async (input: SitTablePayload, resolve, reject) => {
   
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
    }
    let newInGamePlayer: InGamePlayer = createInGamePlayer(data, input.processedData.table.info.maxBuyIn, input.processedData.player);


    //*************************** */
    table.currentInfo.players.push(newInGamePlayer);
    table.currentInfo.vacantSeats = table.currentInfo.vacantSeats - 1;
    table.currentInfo.maxBettingCountOnTable = 1;
    const query = {
        id: table.id
    }
    let updateField = {
        $push: { "currentInfo.players": newInGamePlayer },
        $inc: { "currentInfo.vacantSeats": -1 },
        $set: {
            "currentInfo.maxBettingCountOnTable": 1,
            "currentInfo.isOperationOn": false
        }
    }
    let modTable = await updateTableDataAndUnlock({ filter: query, updateObj: updateField });

    console.log(JSON.stringify(modTable))
    if (!modTable && !modTable.acknowledged && !modTable.modifiedCount) {
        let errorData = { success: false, info: "player couldnt be pushed in table db as waiting" };
        input.processedData.errorData = errorData;
        reject(input);
        return;
    }
    //info, 'Total players after this playerd added - ' + JSON.stringify(table.players));
    resolve(input);
});

//player profile chips and lobby table update
let broadcastLobbyDetails = new Task<SitTablePayload>((input: SitTablePayload, resolve, reject) => {
    //todos lobby table details;
    //todos proper data below:
    // logger.info("broadcastLobbyDetails--", input)
    let info = input.processedData.data.deductChipsResponse;
    let data = { playChips: info.playChips, realChips: info.realChips, instantBonusAmount: info.instantBonusAmount };
    input.client.send("Profile_Update", { playerId: input.playerId, data: data });
    let result = updatePlayerSpectatorData({ playerId: input.playerId, tableId: input.tableId, isSpectator: false });
    resolve(input);
});

let logandCheckGameStart = new Task<SitTablePayload>((input: SitTablePayload, resolve, reject) => {
    // logger.info("logandCheckGameStart--", input)
    let index = input.processedData.table.currentInfo.players.findIndex((player) => player.playerId === input.playerId)
    let player = input.processedData.table.currentInfo.players[index];
    // fireSitBroadcast to all in room
    // console.log(input.room)
    dispatchPlayerSitBroadcast(input.room, player);
    SchedulerHelper.Instance.startPlayerPlaySession(input.tableId, input.playerId, player.playerGame_timeOut_min);

    if (input.processedData.table.currentInfo.players.length === 1) {
        setTimeout(function () {
            let data = { tableId: input.tableId, eventName: <const>"SIT", room: input.room };
            processStartGame(data);
        }, 100);
    }
    resolve(input);
});
