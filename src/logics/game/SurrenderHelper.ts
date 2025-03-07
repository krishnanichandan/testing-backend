import * as LockerHelper from './LockTable/LockerHelper';
import * as engine from '../game/engine'

import { Client, Room } from "colyseus";
import { GameOverPayload, processGameOver } from "./gameOverHelper";
import { GameState, PlayerState } from "./types";
import { MakeMovePayload, processMove, sendTurnFlowBroadcasts } from "./moveHelper";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { clearExistingTimers, startTurnTimer } from "./timerHelper";
import { dispatchGameOverBroadcast, dispatchOnTurnBroadcast, dispatchPlayerSurrenderBroadcast } from "./broadcaster";
import { fetchTable, forceUnlockTable, removePlayerJoin, replaceTable } from "../../db/Queries";

import { GameRoom } from "../../rooms/GameRoom";
import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { PlayerMove } from "./gameConstants";
import { Table } from "../../dataFormats/table";
import { addChips } from "./chipsManagement";
import { findTurnForPlayers } from "./TurnHelper";
import { processStartGame } from "./startGameHelper";
import { updateUser } from "../../db/masterQueries";

type SurrenderPayload = {
    tableId: string;
    playerId: string;
    room?: Room;
    client?: Client
    processedData?: ProcessingData
}

type ProcessingData = {
    broadCastsTurnData: {};
    playerSurrenderBroadCast: { playerId: string; playerName: any; chips: any; chipsTaken: number; state: any; seatIndex: any; };
    broadCastGameOverData?: any;
    table: Table;
    data: {
        clearTimer: boolean;
        chipsTaken: number;
        action?: string;
        index: number;
        origin?: string;
        leaveResponse?: any;
        state?: any;

        isCurrentPlayer?: boolean;
        roundOver?: boolean;
        isGameOver?: boolean;
        chips?: number;
    },
    errorData?: any;
    updatedChips?: {
        realChips?: number,
        playChips?: number,
    }
}

async function getTableDataFromDb(input: SurrenderPayload) {

    let table = await LockerHelper.getTable(input.tableId, "Surrender Called").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        return false;
    }
    input.processedData.table = table;
    return true;
}

export async function processSurrenderMove(input: SurrenderPayload) {
    console.log("surrender Called")
    input.processedData = {
        table: null,
        data: {
            clearTimer: false,
            action: null,
            index: null,
            state: null,
            chipsTaken: 0,
            isCurrentPlayer: false
        },
        broadCastsTurnData: {},
        broadCastGameOverData: {},
        playerSurrenderBroadCast: {
            playerId: "",
            playerName: "",
            chips: 0,

            seatIndex: -1,
            chipsTaken: 0,
            state: ""
        }

    }

    let tableRes = await getTableDataFromDb(input);
    if (!tableRes) {
        // logger.error('Error in fetching table while standing up', { playerId: input.playerId });
        console.log("error in fetching table while standing up");
        return
    }
    let table = input.processedData.table;

    let arr: Task<SurrenderPayload>[] = [checkTableState, validatePlayer, checkPlayerStateAndBet, resetPlayerOnSurrender,
        findTurn];

    let pipeline = (new Pipeline<SurrenderPayload>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });
    let catchedError = null;
    let res = await pipeline.run(input).catch(e => { console.log("exception in surrender player"); catchedError = e; });
    if (!!res) {
        // logger.info('Player leave processed successfully', { playerId: input.playerId });
        let replaceRes = await replaceTableToDb(input.processedData.table);
        if (replaceRes.success) {
            dispatchPlayerSurrenderBroadcast(input.room, input.processedData.playerSurrenderBroadCast);
            sendTurnFlowBroadcasts(input.room, { isCurrentPlayer: input.processedData.data.isCurrentPlayer, turnData: { isGameOver: input.processedData.data.isGameOver, turn: input.processedData.broadCastsTurnData }, gameOverBroadCasts: input.processedData.broadCastGameOverData }, input.tableId, input.processedData.table);
            return ({ success: true, tableId: input.tableId });
        } else {
            return ({ success: false, tableId: input.tableId });
        }

    } else {
        // logger.error('Player leave process failed', { playerId: input.playerId, catchedError });
        await forceUnlockTable(input.tableId);//will integrate Db later

        console.log(catchedError)
        return ({ success: false, tableId: input.tableId, info: catchedError?.processedData?.errorData?.info });

    }
}
// Async function to replace or update a table in the database
async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => { console.log(e) });
    if (!modTable) {
        let errorData = { success: false, info: "table couldnt be updated after move logic" };
        return errorData;
    }
    return { success: true };
}

let checkTableState = new Task<SurrenderPayload>((input: SurrenderPayload, resolve, reject) => {
    let table = input.processedData.table;
    if (table.currentInfo.state === GameState.Idle || table.currentInfo.state === GameState.Over) {
        let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to leave when game is in IDLE or OVER State" });
        input.processedData.errorData = err;
        reject(input);
    }
    resolve(input);
});

let validatePlayer = new Task<SurrenderPayload>((input: SurrenderPayload, resolve, reject) => {
    let index = input.processedData.table.currentInfo.players.findIndex((player) => player.playerId === input.playerId);
    if (index < 0) {
        let err = ({ success: false, tableId: input.tableId, info: "player is not on the table" });
        input.processedData.errorData = err;
        reject(input);
    }
    input.processedData.data.index = index ;
    resolve(input)
});

let checkPlayerStateAndBet = new Task<SurrenderPayload>((input: SurrenderPayload, resolve, reject) => {
    let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
    if (player.initialBet > 0) {
        player.chips += Math.trunc(player.initialBet / 2);
        input.processedData.data.chipsTaken = Math.trunc(player.initialBet / 2) + player.sideBet || 0;
        resolve(input)
    }
    else {
        let err = ({ success: false, tableId: input.tableId, info: "unable to surrender" });
        input.processedData.errorData = err;
        reject(input);
    }
});

// Define a new task to reset the player's state upon surrender
let resetPlayerOnSurrender = new Task<SurrenderPayload>(async (input: SurrenderPayload, resolve, reject) => {
    
// Retrieve the player who is surrendering using the provided index from the table's current information
    let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
    player.initialBet = 0;

// Update the player's state based on their remaining chips and the table's minimum buy-in requirement
// If the player has no chips left or fewer chips than the minimum buy-in, set their state to 'OutOfMoney'
// Otherwise, set their state to 'Waiting' for the next round
    player.state = player.chips <= 0 || player.chips < input.processedData.table.info.minBuyIn ? PlayerState.OutOfMoney : PlayerState.Waiting;

// Reset the player's hand information since they have surrendered
        player.handInfo = {
        left: {
            cards: [],
            handValue: {
                hi: 0,
                lo: 0
            },
            hasBusted: false,
            hasBlackjack: false,
            close: false,
            initialBet: 0,
            availableActions: {
                double: false,
                split: false,
                insurance: false,
                hit: false,
                stand: false,
                surrender: false
            }
        },
        right: {
            cards: [],
            handValue: {
                hi: 0,
                lo: 0
            },
            hasBusted: false,
            hasBlackjack: false,
            close: false,
            initialBet: 0,
            availableActions: {
                double: false,
                split: false,
                insurance: false,
                hit: false,
                stand: false,
                surrender: false
            }
        }
    }
    player.isWaitingPlayer = true;
    player.active = false;
    player.isInsuranceAsked = false;
    player.hasPlacedInsurance = false;
    player.onGameStartBuyIn = 0;
    player.onSitBuyIn = 0;
    player.history = [];
    resolve(input)
});

// This Task is responsible for handling the player surrender action and managing game state transitions based on surrender.
let findTurn = new Task<SurrenderPayload>(async (input: SurrenderPayload, resolve, reject) => {
    let table = input.processedData.table;

    // Filter active players who are not in the 'Waiting' state
    let activePlayers = table.currentInfo.players.filter((player) => player.active && player.state != PlayerState.Waiting);
    // Get a deep copy of the player data at the given index
    let player = JSON.parse(JSON.stringify(table.currentInfo.players[input.processedData.data.index]));
    // Prepare data for broadcasting to other players about this player's surrender
    let playerSurrenderBroadCastData = {
        playerId: input.playerId,
        playerName: player.playerName,
        chips: player.chips,
        chipsTaken: input.processedData.data.chipsTaken,
        state: player.state,
        // state: player.chips <= 0 || player.chips < input.processedData.table.info.minBuyIn ? PlayerState.OutOfMoney : PlayerState.Waiting,

        seatIndex: player.seatIndex
    }
    input.processedData.playerSurrenderBroadCast = playerSurrenderBroadCastData;

// Prepare data about the player's move for this turn (surrender action)
    let currentMoveData: any = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: "Surrender",
        playedPosition: 'right',
        seatIndex: player.seatIndex,
        handInfo: player.handInfo,
        popCard: {}
    }

     // Check if there are no active players left (i.e., all players have surrendered)
    if (activePlayers.length === 0) {
        if (input.processedData.data.index === table.currentInfo.currentMoveIndex && table.currentInfo.currentMoveIndex != -1) {
            input.processedData.data.isCurrentPlayer = true
        }
        clearExistingTimers(input.room as GameRoom)
        input.processedData.table.currentInfo.state = GameState.Over;
        let gameOverPayload = {
            processedData: {
                data: {},
                table: input.processedData.table,
            }
        }

         // Call the processGameOver function to handle the end of the game
        let response = await processGameOver(gameOverPayload as GameOverPayload);
        if (response.success) {
            input.processedData.data.isGameOver = true;
            input.processedData.broadCastGameOverData = response.data.gameOverResponse;
            input.processedData.broadCastsTurnData = {
                currentMoveData,
                nextTurnData: {},
                isDealerMove: false
            }
        }
    } else {
        // If there are still active players, check if the game is over
        if (input.processedData.data.index === table.currentInfo.currentMoveIndex && table.currentInfo.currentMoveIndex != -1) {
            input.processedData.data.isCurrentPlayer = true
        }

        // Check if all players' hands are finished and determine if the game is over
        const gameOverResponse = checkAllHands(input.processedData.table);
        if (gameOverResponse) {
            clearExistingTimers(input.room as GameRoom)
            //game Over Occur changing table State
            input.processedData.table.currentInfo.state = GameState.Over;
            let payload = {
                processedData: {
                    data: {},
                    table: input.processedData.table,
                }
            }

            // Call processGameOver to handle end-of-game logic
            const response = await processGameOver(payload as GameOverPayload)//add more code
            if (response.success) {
                input.processedData.data.isGameOver = true;
                input.processedData.broadCastGameOverData = response.data.gameOverResponse;
                input.processedData.broadCastsTurnData = {
                    currentMoveData,
                    nextTurnData: {},
                    isDealerMove: false
                }
            }

        } else {
            //if player is the one who has current Turn going on
            table.currentInfo.players.sort(function (a, b) { return a.seatIndex - b.seatIndex; });

            let activePlayers: any[] = [];
            let inactivePlayer: any[] = [];

            table.currentInfo.players.forEach((player) => {
                if (!player.active || player.state === PlayerState.Waiting) {
                    inactivePlayer.push(player);
                } else {
                    activePlayers.push(player);

                }
            })
            input.processedData.data.isGameOver = false;
            table.currentInfo.players = activePlayers.concat(inactivePlayer);
            let nextplayer = table.currentInfo.currentMoveIndex
            let turnData = {} as any
            if (input.processedData.data.index === table.currentInfo.currentMoveIndex && table.currentInfo.currentMoveIndex != -1) {
                clearExistingTimers(input.room as GameRoom)
                input.processedData.data.isCurrentPlayer = true;
                console.log('findTurnResponse inside findTurn :: ', table)

                let turnResponse = findTurnForPlayers(table, 'right', false);
                
                turnData = {
                    isDealerMove: turnResponse.isDealerMove,
                    seatIndex: turnResponse.isDealerMove ? -1 : input.processedData.table.currentInfo.players[turnResponse.currentMoveIndex].seatIndex,
                    player: turnResponse.isDealerMove ? null : { ...input.processedData.table.currentInfo.players[turnResponse.currentMoveIndex], turnTime: 10 },
                    dealer: input.processedData.table.currentInfo.dealer,
                    currentPlayingPosition: turnResponse.isDealerMove ? 'right' : turnResponse.currentPlayingPosition
                }
                nextplayer = turnResponse.isDealerMove ? -1 : input.processedData.table.currentInfo.players[turnResponse.currentMoveIndex].seatIndex;
                
            }
            
           
            nextplayer = input.processedData.data.isCurrentPlayer?(nextplayer!=-1 ?table.currentInfo.players.findIndex((player) => player.seatIndex === nextplayer) :-1) :table.currentInfo.currentMoveIndex ;
            table.currentInfo.currentMoveIndex = nextplayer;
            if (turnData.isDealerMove) {
                turnData.nextDecidedActionForDealer = 'holdCardOpen';
            }
            input.processedData.broadCastsTurnData = {
                currentMoveData,
                nextTurnData: turnData,
                isDealerMove: turnData.isDealerMove
            }
        }


    }
    resolve(input)
});
// This function checks if all players' hands are busted in the game.
function checkAllHands(table: Table): boolean {
    for (const player of table.currentInfo.players) {
        if (player.state === PlayerState.Playing || (player.state === PlayerState.Disconnected && player.active === true)) {
            const handInfo = player.handInfo;
            // Check if the player has split their hand into two parts (left and right)
            const hasSplit = player.history.some((x) => x.type === PlayerMove.Split);
            if (hasSplit) {
                const leftBusted = handInfo.left.hasBusted;
                const rightBusted = handInfo.right.hasBusted;
                if (!leftBusted || !rightBusted) {
                    return false; // At least one player has a hand that is not busted
                }
            } else {
                const rightBusted = handInfo.right.hasBusted;
                if (!rightBusted) {
                    return false;
                }
            }

        }
    }
    return true; // All players have both hands busted
}


async function updatePlayerStatsToDb(tablePlayer: InGamePlayer) {

    let updateKeys = {
        statistics: tablePlayer.stats
    }
    //will integrate DB later
    let result = await updateUser({ playerId: tablePlayer.playerId }, updateKeys).catch((e) => {
        console.log("update user error ", e);
        console.log("check y")
    });
    // console.log(result)


}