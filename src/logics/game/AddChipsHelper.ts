import { Client, Room } from "colyseus";
import { GameState, PlayerState } from "./types";
import { deductChips, getUserChips } from "./chipsManagement";
import { dispatchPlayerChipsBroadCast, dispatchPlayerStateBroadcast } from "./broadcaster";
import { fetchTable, replaceTable } from "../../db/Queries";

import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { Table } from "../../dataFormats/table";

// import logger from "../../logger";
// import * as LockerHelper from './LockTable/LockerHelper';


async function getTableDataFromDb(tableId: string) {
    let table = await fetchTable(tableId).catch(e => { });
    // let table = await LockerHelper.getTable(tableId, "AddChips").catch(e => { });

    if (!table) {
        return { success: false, info: "Table not found for this id" };
    }
    return { success: true, table: table };

};

async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => { console.log(e) });
    if (!modTable) {
        return { success: false, info: "table couldnt be updated after add chips logic" };
    }
    return { success: true };
}

type AddChipsPayload = {
    tableId: string;
    playerId: string;
    amount: number;
    isRequested: boolean;
    previousState?: PlayerState;
    room: Room;
    client: Client
}


export async function processAddChips(input: AddChipsPayload) {
    // logger.info('Processing Add Chips request', { tableId: input.tableId });
    let res = await getTableDataFromDb(input.tableId);
    if (!res.success) {
        // logger.error('Failed to get table data from DB', { tableId: input.tableId, error: res.info });
        return res;
    }
    let table = res.table;
    // logger.info('Adding chips on table', { tableId: input.tableId, playerId: input.playerId, amount: input.amount });
    let res2 = await addChipsOnTable(input, table);
    if (res2.success) {
        // logger.info('Chips added successfully, updating table in DB', { tableId: input.tableId });
        let res3 = await replaceTableToDb(table);
        if (res3.success) {
            // logger.info('Table updated in DB after adding chips', { tableId: input.tableId });
            handleAddChipsEvent(input, table, res2.data);
            if (input.previousState === PlayerState.Playing && (res2.data.chipsAdded > 0)) {
                res2.displayInfo = res2.data.chipsAdded + " more chips will be added in next hand."
            }
            return res2;
        } else {
            // logger.error('Failed to update table in DB after adding chips', { tableId: input.tableId, error: res3.info });
            return { success: false, info: "Add Chips could not be processed." }
        }
    } else {
       
        return res2;
    }
}

//#region 
export async function addChipsOnTable(data: AddChipsPayload, table: Table) {
   
    if (data.amount <= 0) {
        return ({ success: false, info: "Cannot add " + data.amount + " chips, provide a value greater than 0." });
    }
    let playerIndexOnTable = table.currentInfo.players.findIndex(player => player.playerId == data.playerId);
    // Validate if player have taken a seat
    if (playerIndexOnTable < 0) {
        // logger.warn('Attempt to add chips in a tournament table', { tableId: table.id });
        return ({ success: false, info: "Invalid attempt to add chips, Please take a seat first!" });
    }
    let player = table.currentInfo.players[playerIndexOnTable];
    player.activityRecord.lastActivityTime = Number(new Date()); // Record last activity of player
    if (table.currentInfo.state == GameState.Running) {
        if (table.currentInfo.onStartPlayers.indexOf(player.playerId) >= 0 && (player.onGameStartBuyIn > 0)) {
            let res = await addChipsOnTableInGame(data, player, table);
            return res;
        }
    }

    let totalChipsAfterAdd = player.state === PlayerState.Reserved ? Math.floor(player.chips) + Math.floor(data.amount) : Math.floor(player.chips) + Math.floor(data.amount) + Math.floor(player.chipsToBeAdded);
    data.previousState = player.state;
    if (player.state === PlayerState.OutOfMoney) {
        player.state = PlayerState.Waiting;
    }
    // Validate adding chips exceed table maxbuy in, which is not allowed
    if (totalChipsAfterAdd > Math.floor(table.info.maxBuyIn) && player.state !== PlayerState.Reserved) {
        let t = (Math.floor(table.info.maxBuyIn) - (totalChipsAfterAdd - Math.floor(data.amount)));
        return ({ success: false, tableId: table.id, info: (t > 0 ? ("You can now add " + t + " more chips.") : ("You cannot add more chips.")) + " Max buyin for table is " + Math.floor(table.info.maxBuyIn) + "." });
    }

    if (totalChipsAfterAdd < Math.floor(table.info.minBuyIn)) {
        return ({ success: false, tableId: table.id, info: "You cannot add " + Math.floor(data.amount) + " chips. Min Buyin for table is " + (table.info.minBuyIn) + "." });
    }

    // If player seat is reserved then check anti banking
    // If player is not in RESERVED then do not check anti banking

    if (player.state === PlayerState.Reserved) {

    } else {
        // logger.info('Deducting chips for player not in reserved state', { tableId: table.id, playerId: data.playerId });
        let res = await doDeductChips(data, player, false, table);
        return res;
    }

}

// add chips in game
// WHEN PLAYER IS PART OF GAME
async function addChipsOnTableInGame(data: AddChipsPayload, player: InGamePlayer, table: Table) {
    let totalChipsAfterAdd = Math.floor(player.chips) + Math.floor(data.amount) + Math.floor(player.chipsToBeAdded);
    data.previousState = player.state;
    if (totalChipsAfterAdd > Math.floor(table.info.maxBuyIn) && player.state !== PlayerState.Reserved) {

        var t = (Math.floor(table.info.maxBuyIn) - (totalChipsAfterAdd - Math.floor(data.amount)));
        
        return ({ success: false, info: (t > 0 ? ("You can now add " + t + " more chips.") : ("You cannot add more chips.")) + " Max buyin for table is " + Math.floor(table.info.maxBuyIn) + "." });
        // return false;
    }

    if (totalChipsAfterAdd < Math.floor(table.info.minBuyIn)) {
        return ({ success: false, info: "You cannot add " + Math.floor(data.amount) + " chips. Min Buyin for table is " + Math.floor(table.info.minBuyIn) + "." });
    }

    // If player seat is reserved then check anti banking
    // If player is not in RESERVED then do not check anti banking

    let res = await doDeductChips(data, player, true, table);
    return res;
}

// ### Deduct chips from player profile (in add chips request)
async function doDeductChips(input: AddChipsPayload, player: InGamePlayer, doNotDeduct: boolean, table: Table) {
    let playerChipDetails: any = {}; //chipsInHand,isChipsToUpdate,newChipsToAdd,newChips
    // Deduct amount from profile and then add chips on table amount
    let relevantFunction: Function;
    if (doNotDeduct) {
        relevantFunction = getUserChips;
    } else {
        relevantFunction = deductChips;
    }

    let deductChipsResponse = await relevantFunction({ playerId: player.playerId, isRealMoney: table.info.isRealMoney, chips: input.amount, tableId: input.tableId, subCategory: "Add Chips", tableName: table.info.name });

    if (deductChipsResponse.success) {
        playerChipDetails.chipsInHand = player.chips;
        playerChipDetails.isChipsToUpdate = false;

        player.activityRecord.totalChipsAdded += Math.trunc(input.amount);
        // Set player state waiting if in reserved after successfull addition of chips
        if (player.state === PlayerState.Reserved) {
            player.state = PlayerState.Waiting;
            player.chips = Math.floor(player.chips) + Math.floor(input.amount);
            player.instantBonusAmount = Math.floor(player.instantBonusAmount) + deductChipsResponse.instantBonusAmount;
            playerChipDetails.newChips = input.amount;
        } else if (player.state === PlayerState.Playing) {
            if (doNotDeduct) {
                // console.log("playing doNotDeduct");
                player.chipsToBeAdded = player.chipsToBeAdded + Math.floor(input.amount);
                playerChipDetails.isChipsToUpdate = true;
                playerChipDetails.newChipsToAdd = input.amount;
            } else {
                // console.log("playing else");
                player.chips = Math.floor(player.chips) + Math.floor(input.amount);
                player.instantBonusAmount = Math.floor(player.instantBonusAmount) + deductChipsResponse.instantBonusAmount;
                playerChipDetails.newChips = input.amount;
            }
        } else {
            // console.log("overall else");
            player.chips = Math.floor(player.chips) + Math.floor(input.amount);
            player.instantBonusAmount = Math.floor(player.instantBonusAmount) + deductChipsResponse.instantBonusAmount;
            playerChipDetails.newChips = input.amount;
        }

        let toReturn = {
            success: true,
            amount: player.chips,
            chipsAdded: player.chipsToBeAdded,
            state: player.state,
            playerName: player.playerName,
            realChips: deductChipsResponse.realChips,
            playChips: deductChipsResponse.playChips,
            instantBonusAmount: player.instantBonusAmount
        }

        // player.chips        = parseInt(player.chips) + parseInt(params.data.amount); // Commented to modify add chips to be reflected after Game Over
        player.onSitBuyIn = player.chips + player.chipsToBeAdded;
        return ({ success: true, data: toReturn });
    } else {
        
        deductChipsResponse.state = player.state;
        return (deductChipsResponse);
    }
};



//#endregion

function handleAddChipsEvent(input: AddChipsPayload, table: Table, addChipsResponse: any) {
    // logger.info('handleAddChipsEvent started', { input: input, addChipsResponse: addChipsResponse });
    if (addChipsResponse.success) {
       
        let data = { freeChips: addChipsResponse.playChips, realChips: addChipsResponse.realChips + addChipsResponse.instantBonusAmount, instantBonusAmount: addChipsResponse.instantBonusAmount };
        input.client.send("Profile_Update", { playerId: input.playerId, data: data });

        // Inform player about chips for next game

        let playerIndexOnTable = table.currentInfo.players.findIndex(player => player.playerId == input.playerId);
        let player = table.currentInfo.players[playerIndexOnTable];

        // if (table.currentInfo.state != GameStates.Running) {
        let data5 = { tableId: input.tableId, playerId: input.playerId, chips: addChipsResponse.amount, totalChipsAdded: player?.activityRecord?.totalChipsAdded };
        dispatchPlayerChipsBroadCast(input.room, data5);
    
        dispatchPlayerStateBroadcast(input.room, { tableId: input.tableId, playerId: input.playerId, playerState: addChipsResponse.state });

    }
}