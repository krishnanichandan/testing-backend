import * as LockerHelper from './LockTable/LockerHelper';

import { GameState, PlayerState } from "./types";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { dispatchPlayerInsuranceBroadCasts, dispatchPlayerStateBroadcast } from "./broadcaster";
import { fetchTable, forceUnlockTable, replaceTable } from "../../db/Queries";

import { GameRoom } from "../../rooms/GameRoom";
import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { PlayerMove } from "./gameConstants";
import { Room } from "colyseus";
import { Table } from "../../dataFormats/table";
import { clearExistingTimers } from "./timerHelper";
import { performInsuranceOnTable } from "./AutoMovesHelper";

type PlayerInsurancePayload = {
    action: any;
    isInsurancePlaced: boolean;
    tableId: string;
    playerId: string;
    room?: Room;
    processedData?: ProcessingData;
}
type ProcessingData = {
    data: {
        deductTableChipsResponse: any;
        isCurrentPlayer: boolean;
        isGameOver: boolean;
        action: any;
        playerName: string;
        index: number,
        seatIndex: number,
        chips: number,
        amount: number,
        playerId: string
    },
    table: Table,
    player: InGamePlayer;
    errorData?: ErrorData
}
type ErrorData = {
    success: boolean;
    tableId?: string;
    info: string
}

async function checkAllPlayersPlacedInsurance(input: any): Promise<void> {
    let table = await fetchTable(input.tableId).catch(e => {
    });
    if (!table) {

        return;
    }
    else {
        let insurancePlayers = table.currentInfo.players.filter((player) => (player.active && player.isInsuranceAsked && !player.hasPlacedInsurance))
        if (insurancePlayers.length) {
            return;
        } else {
            let playersWhoPlacedInsurance = table.currentInfo.players.filter((player) => (player.active && player.isInsuranceAsked && player.hasPlacedInsurance))
            if (playersWhoPlacedInsurance.length) {
                return
                clearExistingTimers(input.room as GameRoom);
                let movePayload={
                    room:input.room
                }
            }
            
            return;
        }
    }
}
    

/**
 * 
 * @param data PlayerInsurancePayload
 * @returns 
 */
export async function processInsuranceMove(data: PlayerInsurancePayload) {
    console.log("player Insurance called");
    let arr: Task<PlayerInsurancePayload>[] = [getTableDataFromDb, initData, ifMoveValid, validateEnoughChips, validateProfileAmount];

    let pipeline = (new Pipeline<PlayerInsurancePayload>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });

    data.processedData = {
        data: {
            index: -1,
            isGameOver: false,
            chips: 0,
            seatIndex: 0,
            amount: 0,
            playerId: "",
            deductTableChipsResponse: {},
            isCurrentPlayer: false,
            action: "",
            playerName: ""
        },
        table: null,
        player: null,
    };

    let catchedError: any = null;
    let res = await pipeline.run(data).catch(e => { console.log("exception in process Insurance"); catchedError = e; });

    if (!!res) {
        let res: any = await replaceTableToDb(data.processedData.table);
        if (res.success) {
            console.log("process Insurance completed");
            //To Do Clear Insurance Timers
            dispatchPlayerInsuranceBroadCasts(data.room, { tableId: data.tableId, playerId: data.playerId, isInsurancePlaced: data.processedData.player.hasPlacedInsurance, sideBet: data.processedData.player.sideBet, chips: data.processedData.player.chips, availableActions: {} ,seatIndex:data.processedData.player.seatIndex});

            let insurancePlayers = data.processedData.table.currentInfo.players.filter((player) => (player.active && player.isInsuranceAsked && !player.hasPlacedInsurance))
            if (insurancePlayers.length) {

            } else {
                clearExistingTimers(data.room as GameRoom);
                let payload = {
                    tableId: data.tableId,
                    room: data.room
                }
                performInsuranceOnTable(payload)
            }
           
            return { success: true };
        } else {
            return res;
        }
    } else {
        if (catchedError.processedData?.errorData?.success) {
            let res = await replaceTableToDb(data.processedData.table);
            if (res.success) {
                console.log("replace table when game over etc");
                return { success: true };
            } else {
                return res;
            }
        } else {
            // logger.error('Process move exception', { catchedError });
            if (!!data.processedData.table) {
                let id = data.processedData.table?.id;
                await forceUnlockTable(id);//will include it later
            }
            console.log("process Insurance Move exception", catchedError);
        }
    }


};

let getTableDataFromDb = new Task<PlayerInsurancePayload>(async (input: PlayerInsurancePayload, resolve, reject) => {
    
    let table = await LockerHelper.getTable(input.tableId, "Player Insurance").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
});

let initData = new Task<PlayerInsurancePayload>(async (input: PlayerInsurancePayload, resolve, reject) => {
    let table = input.processedData.table;
    input.processedData.data.index = table.currentInfo.players.findIndex((player: { playerId: string; state: PlayerState; }) => player.playerId === input.playerId && player.state === PlayerState.Playing);
    // Check if player is in Disconnected state
    // In case auto turn for disconnected players
    //will check it in auto case-> leaving it as of now
    if (input.processedData.data.index < 0) {
        input.processedData.data.index = table.currentInfo.players.findIndex((player: { playerId: string; state: any; }) => player.playerId === input.playerId && player.state === PlayerState.Disconnected);
    }
    // Return if no index found while performing action
    if (input.processedData.data.index < 0) {
        let errorData = ({ success: false, tableId: (input.tableId || ""), info: "UnableToPerform" + input.action });
        input.processedData.errorData = errorData;
        reject(input);
        return;
    }
    input.processedData.player = table.currentInfo.players[input.processedData.data.index];
    let player = input.processedData.player;

    input.processedData.data.playerName = player.playerName;
    input.processedData.data.seatIndex = player.seatIndex;

    input.processedData.data.action = input.action;
    input.processedData.data.isGameOver = (table.currentInfo.state === GameState.Over);
    input.processedData.data.chips = player.chips;
    input.processedData.data.amount = Math.trunc(player.initialBet / 2);//it's the amount which player has to give when he will be place insurance
    input.processedData.data.isCurrentPlayer = true;
    input.processedData.data.playerId = input.playerId;
    resolve(input);
});

let ifInsuranceActionAlreadyTaken = new Task<PlayerInsurancePayload>((input: PlayerInsurancePayload, resolve, reject) => {
    if (input.processedData.player.insuranceActionTaken) {
        let ed: ErrorData = ({ success: false, tableId: (input.tableId || ""), info: `${input.action} is not allowed here.` });
        input.processedData.errorData = ed;
        reject(input)
    } else {
        resolve(input)
    }
});

let ifMoveValid = new Task<PlayerInsurancePayload>((input: PlayerInsurancePayload, resolve, reject) => {

    //one more check to know either insurance is asked or not
    if (Object.values(PlayerMove).includes(input.action)) {
        resolve(input);
    } else {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: input.action + " is not a valid move" });
        input.processedData.errorData = ed;
        reject(input);
    }

});

let validateEnoughChips = new Task<PlayerInsurancePayload>(async (input: PlayerInsurancePayload, resolve, reject) => {
    let table = input.processedData.table;
    let player = input.processedData.player;
    let considerAmount = Math.trunc(player.initialBet / 2);
    //will include this check for safe side also &&player.isInsuranceAsked in if block
    if (player.chips < considerAmount && input.isInsurancePlaced) {
        const errorData = { success: false, info: "Not enough Money to place Insurance", playerId: input.playerId };
        input.processedData.errorData = errorData;
        reject(input);
    } else {
        resolve(input)
    }
});

let validateProfileAmount = new Task<PlayerInsurancePayload>(async (input: PlayerInsurancePayload, resolve, reject) => {
    // logger.info("validateProfileAmount--", input)
    let payload = {
        tableId: input.tableId,
        chips: input.processedData.data.amount,
        playerId: input.playerId,
        player: input.processedData.player
    }
    if (input.isInsurancePlaced) {
        let deductTableChipsResponse = deductTableChips(payload);
        if (deductTableChipsResponse.success) {

            input.processedData.data.deductTableChipsResponse = deductTableChipsResponse;
            input.processedData.player = deductTableChipsResponse.player;
            input.processedData.player.hasPlacedInsurance = true;
            input.processedData.player.insuranceActionTaken = true;
            //will changes it's schema later will include both the bets in single object

            input.processedData.table.currentInfo.players[input.processedData.data.index] = input.processedData.player;
            input.processedData.table.currentInfo.isInsurancePlacedOnTable = true;
            
            resolve(input)

        } else {
            input.processedData.errorData = deductTableChipsResponse;
            // logger.info("validateProfileAmount errorData", input)
            //unlock table forceFully
            reject(input)
            // return
        }
    } else {
        input.processedData.player.hasPlacedInsurance = false;
        input.processedData.player.isInsuranceAsked = false;
        input.processedData.player.insuranceActionTaken = true;
        input.processedData.player.sideBet = 0;
        input.processedData.player.history.push({
            type: PlayerMove.Insurance,
            card: [],
            amount: 0,
            isInurancePlace: input.isInsurancePlaced
        });

        input.processedData.table.currentInfo.players[input.processedData.data.index] = input.processedData.player;
        //only change it's player Status that Insurance is not placed
        resolve(input)
    }

});

function deductTableChips(input: any) {
    if (input.chips > input.player.chips) {
        return { success: false, info: "not enough chips select different amount", playerId: input.playerId }
    } else {
        let player = input.player;
        let chips = input.chips;

        player.chips = player.chips - chips;
        //reset player State
        player.sideBet = chips;
        player.totalBetOnTable += chips;

        player.history.push({
            type: PlayerMove.Insurance,
            card: [],
            amount: chips,
            isInurancePlace: input.isInsurancePlaced
        });
        //playerState Broadcast for Ready and applied chips
        return { success: true, info: "player has place SideBets For Insurance", player: player }
    }
};

async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => {
        console.log(e)
    });
    if (!modTable) {

        let errorData = { success: false, info: "table couldnt be updated after move logic" };
        return errorData;
    }

    // logger.info('Table successfully replaced in database', { tableId: table.id });
    return { success: true };
};


