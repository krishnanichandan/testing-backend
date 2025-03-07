import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { Room } from "colyseus"
import { Table } from "../../dataFormats/table";
import { fetchTable, forceUnlockTable, replaceTable } from "../../db/Queries";
import { GameState, PlayerState } from "./types";
import { MakeMovePayload, processMove } from "./moveHelper";
import { findTurnForPlayers } from "./TurnHelper";
import * as engine from '../game/engine'
import { GameOverPayload, processGameOver } from "./gameOverHelper";
import { dispatchGameOverBroadcast, dispatchOnTurnBroadcast } from "./broadcaster";
import { GameRoom } from "../../rooms/GameRoom";
import { clearExistingTimers, startTurnTimer } from "./timerHelper";
import { processStartGame } from "./startGameHelper";
import * as LockerHelper from './LockTable/LockerHelper';
import { Player } from "../../dataFormats/player";

export type InsurancePayload = {
    room: Room,
    tableId: string,
    processedData?: ProcessingData;
}
type ProcessingData = {
    broadcastGameOverData: any;
    data: {
        isGameOver: boolean;
        isInsuranceAsked: boolean;
        isInsurancePlacedOnTable: boolean;
        callMoveHelper: boolean;
    },
    table: Table,
    errorData?: ErrorData
}
type ErrorData = {
    success: boolean;
    tableId?: string;
    info: string
}
export async function performInsuranceOnTable(data: InsurancePayload) {

    console.log("player Auto Insurance called");
    let arr: Task<InsurancePayload>[] = [getTableDataFromDb, ifInsuranceAsked, performInsurance];

    let pipeline = (new Pipeline<InsurancePayload>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });

    data.processedData = {
        data: {
            isGameOver: false,
            isInsuranceAsked: false,
            isInsurancePlacedOnTable: false,
            callMoveHelper: false
        },
        table: null,
        broadcastGameOverData: {}
    };

    let catchedError: any = null;
    let res = await pipeline.run(data).catch(e => { console.log("exception in process Auto Insurance"); catchedError = e; });

    if (!!res) {
        let res: any = await replaceTableToDb(data.processedData.table);
        if (res.success) {
            console.log("process Auto Insurance Move completed");
            //To Do Clear Insurance Timers
            // dispatchPlayerInsuranceBroadCasts(data.room, { tableId: data.tableId, playerId: data.playerId, isInsurancePlaced: data.processedData.player.hasPlacedInsurance, sideBet: data.processedData.player.sideBet, chips: data.processedData.player.chips, availableActions: {} });
            // dispatchPlayerStateBroadcast(data.room, { tableId: data.tableId, playerId: data.playerId, playerState: data.processedData.player.state });
            sendTurnFlowBroadcasts(data.room, data.processedData.data, data.tableId, data.processedData.table);

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
            if (!!data.processedData.table) {
                let id = data.processedData.table?.id;
                await forceUnlockTable(id);//will include it later
            }
            console.log("process Insurance Move exception", catchedError);
            return
        }
    }
}


let getTableDataFromDb = new Task<InsurancePayload>(async (input: InsurancePayload, resolve, reject) => {
    // let table = await fetchTable(input.tableId).catch(e => {
    // });
    
    let table = await LockerHelper.getTable(input.tableId, "Auto Insurance Move").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    input.processedData.data.isInsuranceAsked = table.currentInfo.isInsuranceAsked;
    input.processedData.data.isInsurancePlacedOnTable = table.currentInfo.isInsurancePlacedOnTable;
    resolve(input);
});

let ifInsuranceAsked = new Task<InsurancePayload>((input: InsurancePayload, resolve, reject) => {

    //one more check to know either insurance is asked or not
    if (input.processedData.table.currentInfo.isInsuranceAsked) {
        resolve(input);
    } else {
        let ed = ({ success: false, tableId: (input.tableId || ""), info: "Insurance not asked on Table" });
        input.processedData.errorData = ed;
        reject(input);
    }

});

let performInsurance = new Task<InsurancePayload>(async (input: InsurancePayload, resolve, reject) => {
    let isInsurancePlacedOnTable = input.processedData.table.currentInfo.isInsurancePlacedOnTable;
    let isInsuranceAsked = input.processedData.table.currentInfo.isInsuranceAsked;
    let insurancePlayers = input.processedData.table.currentInfo.players.filter((player) => (player.isInsuranceAsked && (player.state === PlayerState.Playing || (player.state === PlayerState.Disconnected && player.hasPlacedInsurance))));
    let disconnectedPlayers = input.processedData.table.currentInfo.players.filter((player) => player.state === PlayerState.Disconnected && player.active && player.isInsuranceAsked && !player.hasPlacedInsurance);

    disconnectedPlayers.forEach((player) => {//this might break if incase player has placed sidebet but then went in Disconnect State so for now 
        player.hasPlacedInsurance = false;
        player.isInsuranceAsked = false;
    })
    if (isInsurancePlacedOnTable && insurancePlayers.length) {//game Over Case after holdcardOpen
        insurancePlayers.forEach((player) => {
            player.isInsuranceAsked = false;
        });
        //calling move helper to direct game Over Flow
        // input.processedData.data.callMoveHelper = true;
        // resolve(input);
    }
    //  else {
    let table = input.processedData.table;
    let players = table.currentInfo.players;
    let currentMoveIndex = table.currentInfo.currentMoveIndex;
    let firstActivePlayer = table.currentInfo.players.find((player) => (player.state === PlayerState.Playing && player.active === true));
    let firstActiveIndex = table.currentInfo.players.indexOf(firstActivePlayer);
    table.currentInfo.firstActiveIndex = firstActiveIndex;
    table.currentInfo.currentMoveIndex = firstActiveIndex;
    let turnResponse = findTurnForPlayers(table, 'right', false);
    table.currentInfo.currentMoveIndex = turnResponse.currentMoveIndex;
    table.currentInfo.currentPlayingPosition = 'right'
    const playerDataTosend: any = turnResponse.isDealerMove ? {} : table.currentInfo.players[turnResponse.currentMoveIndex];
    let dataToSend = {}
    console.log("autoMoves->",playerDataTosend," ",turnResponse.isDealerMove)
    if (playerDataTosend&&Object.keys(playerDataTosend).length){dataToSend = {
        seatIndex: playerDataTosend.seatIndex,
        initialBet: playerDataTosend.initialBet,
        turnTime: 10,
        playerId: playerDataTosend.playerId,
        tableId: playerDataTosend.tableId,
        playerName: playerDataTosend.playerName,
        active: playerDataTosend.active,
        chips: playerDataTosend.chips,
        avatar: playerDataTosend.avatar,
        state: playerDataTosend.state,
        isWaitingPlayer: playerDataTosend.isWaitingPlayer,
        sideBet:playerDataTosend.sideBet,
        handInfo:playerDataTosend.handInfo,
        hasBlackJack:playerDataTosend.hasBlackJack,
        hasPlacedInsurance:playerDataTosend.hasPlacedInsurance,

    }}
    let turndata = {
        isGameOver: turnResponse.isDealerMove ? true : false,
        turn: {
            isDealerMove: turnResponse.isDealerMove,
            seatIndex: turnResponse.isDealerMove ? -1 : table.currentInfo.players[turnResponse.currentMoveIndex].seatIndex,
            player: dataToSend,
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: turnResponse.currentPlayingPosition
        },
        currentMoveData: {}
    }
    if (turnResponse.isDealerMove) {
        //meaning blackJack Happen and only one player
        //gameOver Case
        table.currentInfo.state = GameState.Over;
        let payload = {
            processedData: {
                data: {},
                table: table,
            }
        }
        const dealer = table.currentInfo.dealer;
        dealer.hand = [...dealer.hand, dealer.holdCard]
        const dealerPoints = engine.calculate(dealer.hand);
        dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
        const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
        dealer.isBusted = dealerHigherValidValue > 21;
        dealer.isVisible = true;
        dealer.isHoldCardOpened = true;
        dealer.totalPoints = dealerPoints;
        let currentMoveData: any = {
            isDealerMove: true,
            action: "holdCardOpen",
            dealerPoints,
            handInfo: dealer.hand,
            hasBlackjack: dealer.hasBlackjack,
            isBusted: dealer.isBusted,
            handValue: dealerPoints
        }
        table.currentInfo.dealer = dealer;
        //check this again
        const response = await processGameOver(payload as GameOverPayload)
        if (response.success) {
            input.processedData.data.isGameOver = true;

            input.processedData.broadcastGameOverData = response.data.gameOverResponse;
        }

        setTimeout(function () {
            console.log('automove helper dispatch turn 1 :: ')
            dispatchOnTurnBroadcast(input.room, { isGameOver: input.processedData.data.isGameOver, turn: { currentMoveData, isDealerMove: true, nextTurnData: {} } });
        }
        , (2000));
        if (input.processedData.data.isGameOver) {
            setTimeout(function () {
                dispatchGameOverBroadcast(input.room, { playersResult: response.data.gameOverResponse.playersResult, dealer: response.data.gameOverResponse.dealer })
            }, (2000));
        }
        //need to add restart game here i guess
    } else {
        let numCards = 2;
        let firstTurnTimer = input.room.clock.setTimeout(function (params: any) {
            //     // only if move is needed : currentMoveIndex >= 1 (for seatIndex) : TODO maybe
            //     // Send player turn broadcast to channel level

            dispatchOnTurnBroadcast(input.room, turndata);
            startTurnTimer({ room: input.room as GameRoom, table: input.processedData.table, isTurnTime: true });

        }, 300, input);
    }

    // }
    resolve(input);

});

async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => {
        console.log(e)
    });
    if (!modTable) {

        let errorData = { success: false, info: "table couldnt be updated after auto Move logic" };
        return errorData;
    }

    // logger.info('Table successfully replaced in database', { tableId: table.id });
    return { success: true };
}


export function sendTurnFlowBroadcasts(room: Room, response: any, tableId: string, table: Table) {

    if (response.callMoveHelper) {
        //need to clear existing timer
        clearExistingTimers(room as GameRoom)
        let movePayload = {
            room,
            tableId,
            isDealerMove: true,
            action: "holdCardOpen"
        }
        setTimeout(function () {
            processMove(movePayload as MakeMovePayload)
                .then(() => {

                })
                .catch((error: any) => {
                    console.error("Error processing move:", error);

                });
        }, 1000);
        // }
    }


    if (response.isGameOver) {

        // restart game if game over occurs
        setTimeout(function () {
            let payload = {
                tableId: tableId,
                eventName: <const>"RESUME",

                room: room
            };
            processStartGame(payload)
        }, (6000));
    }


}

type BettingMovePayload = {
    tableId: string,
    room: Room,
    processedData?: ProcessingDataForBetting
}
type ProcessingDataForBetting = {
    errorData: { success: boolean; info: string; };
    data: any,
    table: Table
}
export async function performAutoBettingMove(data: BettingMovePayload) {
    console.log("playerDeal called");
    let arr: Task<BettingMovePayload>[] = [getTableDataFromDbForBetPhase, checkBettingPhase, resetPlayerState];

    let pipeline = (new Pipeline<BettingMovePayload>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });

    data.processedData = {
        data: {
            isBettingPlayerAvailable: false,
            startGame: false
        },
        table: null,
        errorData: { success: false, info: "" }
    };

    let catchedError: any = null;
    let res = await pipeline.run(data).catch(e => { console.log("exception in process Auto Deal"); catchedError = e; });

    if (!!res) {
        let res: any = await replaceTableToDb(data.processedData.table);
        if (res.success) {
            console.log("process Auto Deal Move completed");
            let startGamePayload = {
                eventName: <const>"RESUME",
                tableId: data.tableId,
                room: data.room
            }
            setTimeout(() => {
                processStartGame(startGamePayload)
            }, 300);

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
            console.log("process auto Deal Move exception", catchedError.processedData?.errorData);
        }
    }
}

let getTableDataFromDbForBetPhase = new Task<BettingMovePayload>(async (input: BettingMovePayload, resolve, reject) => {
    // let table = await fetchTable(input.tableId).catch(e => {
    // });
    
    let table = await LockerHelper.getTable(input.tableId, "Auto Deal Process").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
});

let checkBettingPhase = new Task<BettingMovePayload>(async (input: BettingMovePayload, resolve, reject) => {
    if (input.processedData.table.currentInfo.state != GameState.Betting) {
        input.processedData.errorData = { success: false, info: "Game is not in Betting State" };
        reject(input)
    } else if (input.processedData.table.currentInfo.state === GameState.Betting) {
        resolve(input)
    } else {
        input.processedData.errorData = { success: false, info: "Game is not in Betting State" };
        reject(input)
    }

});

let resetPlayerState = new Task<BettingMovePayload>(async (input: BettingMovePayload, resolve, reject) => {
    let bettingPlayers = input.processedData.table.currentInfo.players.filter((player) => (player.state === PlayerState.Betting || player.state === PlayerState.Disconnected) && player.active);
    let readyPlayers = input.processedData.table.currentInfo.players.filter((player) => (player.state === PlayerState.Ready || player.state === PlayerState.Disconnected) && player.active);
    let isReadyPlayerAvailable = false;
    let isBettingPlayerAvailable = false;
    if (readyPlayers.length) {
        readyPlayers.forEach((player) => {
            if (player.initialBet > 0) {
                player.state = PlayerState.Ready;
                isReadyPlayerAvailable = true;
            }
        })
    }
    if (bettingPlayers.length) {
        bettingPlayers.forEach((player) => {
            if (player.initialBet > 0) {
                player.state = PlayerState.Ready;
            } else {
                player.state = PlayerState.Waiting;
                player.showContinueBetPopUp = true;
                player.active = false;
                player.playerDealtInLastRound = false;
                input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
            }
        });


        bettingPlayers.forEach((player) => {
            if (player.state === PlayerState.Betting) {
                isBettingPlayerAvailable = true;
            }
        })
    }
    input.processedData.data.isBettingPlayerAvailable = isBettingPlayerAvailable;
    input.processedData.data.startGame = true;
    input.processedData.table.currentInfo.state = isReadyPlayerAvailable ? GameState.Betting : GameState.Idle;
    
    resolve(input);
    
})