import { Room } from "colyseus";
import { Table } from "../../dataFormats/table";
import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { fetchTable, forceUnlockTable, replaceTable } from "../../db/Queries";
import { GameState, PlayerState } from "./types";
import { Player } from "../../dataFormats/player";
import { PlayerMove } from "./gameConstants";
import { processStartGame } from "./startGameHelper";
import * as LockerHelper from './LockTable/LockerHelper';
import { dispatchPlayerDealBroadCast, dispatchPlayerStateBroadcast } from "./broadcaster";
import { SchedulerHelper } from "./SchedulerHelper";


type PlayerDealPayload = {
    action: any;
    tableId: string;
    playerId: string;
    amount: number;
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

export async function processDealMove(data: PlayerDealPayload) {
    console.log("playerDeal called");
    let arr: Task<PlayerDealPayload>[] = [getTableDataFromDb, initData, ifMoveValid, validateMinAndMaxBet, validateProfileAmount];

    let pipeline = (new Pipeline<PlayerDealPayload>());
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
    let res = await pipeline.run(data).catch(e => { console.log("exception in process move"); catchedError = e; });

    if (!!res) {
        let res: any = await replaceTableToDb(data.processedData.table);
        if (res.success) {
            SchedulerHelper.Instance.clearInactivePlayerJob(data.tableId, data.playerId);
            console.log("process Deal Move completed");
            //To Do Clear Deal Timers
            dispatchPlayerDealBroadCast(data.room, { tableId: data.tableId, playerId: data.playerId, player: data.processedData.player });
            dispatchPlayerStateBroadcast(data.room, { tableId: data.tableId, playerId: data.playerId, playerState: data.processedData.player.state });
            // sendTurnFlowBroadcasts(data.room, data.processedData.broadCastNextTurnData, data.tableId, data.processedData.table);
            setTimeout(function () {
                let dataToStart = { tableId: data.tableId, eventName: <const>"RESUME",room:data.room };
                processStartGame(dataToStart);
            }, 200);
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
            console.log("process Deal Move exception", catchedError);
        }
    }


};

let getTableDataFromDb = new Task<PlayerDealPayload>(async (input: PlayerDealPayload, resolve, reject) => {
  
    let table = await LockerHelper.getTable(input.tableId, "Player Deal").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
});

let initData = new Task<PlayerDealPayload>(async (input: PlayerDealPayload, resolve, reject) => {
    let table = input.processedData.table;
    input.processedData.data.index = table.currentInfo.players.findIndex((player: { playerId: string; state: PlayerState; }) => player.playerId === input.playerId && player.state === PlayerState.Betting);
    // Check if player is in Disconnected state
    // In case auto turn for disconnected players
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
    input.processedData.data.amount = Math.trunc(input.amount) || 0;
    input.processedData.data.isCurrentPlayer = true;
    input.processedData.data.playerId = input.playerId;
    resolve(input);
});

let ifMoveValid = new Task<PlayerDealPayload>((input: PlayerDealPayload, resolve, reject) => {
    if (Object.values(PlayerMove).includes(input.action) && input.processedData.player.initialBet === 0) {
        resolve(input);
    } else {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: input.action + " is not a valid move" });
        input.processedData.errorData = ed;
        reject(input);
    }

});


let validateMinAndMaxBet = new Task<PlayerDealPayload>(async (input: PlayerDealPayload, resolve, reject) => {
    let table = input.processedData.table;
    if (input.amount < table.info.minBuyIn || input.amount > table.info.maxBuyIn) {
        const errorData = { success: false, info: "pls place Min Bet", playerId: input.playerId };
        input.processedData.errorData = errorData;
        reject(input);
    } else {
        resolve(input)
    }
});

let validateProfileAmount = new Task<PlayerDealPayload>(async (input: PlayerDealPayload, resolve, reject) => {
    let payload = {
        tableId: input.tableId,
        chips: input.amount,
        playerId: input.playerId,
        player: input.processedData.player
    }
    let deductTableChipsResponse = deductTableChips(payload);
    if (deductTableChipsResponse.success) {

        input.processedData.data.deductTableChipsResponse = deductTableChipsResponse;
        input.processedData.player = deductTableChipsResponse.player;
        input.processedData.table.currentInfo.players[input.processedData.data.index] = input.processedData.player;
        resolve(input)

    } else {
        input.processedData.errorData = deductTableChipsResponse;
        // logger.info("validateProfileAmount errorData", input)
        //unlock table forceFully
        reject(input)
        // return
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
        player.state = PlayerState.Ready;
        player.initialBet = chips;
        player.handInfo.right.initialBet = chips;
        player.handInfo.right.availableActions.surrender = true;
        player.playerDealtInLastRound = true;
        player.showContinueBetPopUp = false;
        player.totalBetOnTable += chips;

        player.history.push({
            type: PlayerMove.Deal,
            card: [],
            amount: chips,
        });
        //history also
        //playerState Broadcast for Ready and applied chips
        return { success: true, info: "player is Ready to play", player: player }
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
}

