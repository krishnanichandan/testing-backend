import { PlayerMove } from "./gameConstants";
import * as engine from '../game/engine'
import { Dealer, Table } from "../../dataFormats/table";
import { Room } from "colyseus";
import { GameState, PlayerState } from "./types";
import { HandInfo, HandInfoDetail, History, InGamePlayer } from "../../dataFormats/InGamePlayer";
import { dispatchGameOverBroadcast, dispatchLeaveBroadcast, dispatchOnTurnBroadcast } from "./broadcaster";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { clearExistingTimers, startTurnTimer } from "./timerHelper";
import { GameRoom } from "../../rooms/GameRoom";
import { fetchTable, forceUnlockTable, replaceTable } from "../../db/Queries";
import { findTurnForPlayers } from "./TurnHelper";
import { Card } from "./Cards/Card";
import * as LockerHelper from './LockTable/LockerHelper';
import { GameOverPayload, processGameOver } from "./gameOverHelper";
import { processStartGame } from "./startGameHelper";
import { findUser } from "../../db/masterQueries";
import axios from "axios";
import * as dotenv from 'dotenv';
import { any } from "underscore";
dotenv.config()

let isProcessingMove = false;
export type MakeMovePayload = {
    tableId: string;
    playerId?: string;
    isDealerMove?: boolean;
    isInsurancePlaced?: boolean;
    action: PlayerMove | "holdCardOpen";
    actionPayload?: ActionPayload;
    dealer?: Dealer
    processedData?: ProcessingData;
    room: Room
}

type ActionPayload = {
    playedPosition: 'left' | 'right'//only Left or Right
    bet?: number;
    sideBets?: number;
}

type ProcessingData = {
    player?: any;
    broadCastTurnData?: { isGameOver?: boolean, currentMoveData: any; nextTurnData: any; isDealerMove: boolean };
    data: {
        originAmount: number;
        considerAmount: any;
        amount: number;
        chips: number;
        playerId: string;
        isCurrentPlayer: boolean;
        action: PlayerMove | "holdCardOpen";
        index: number;
        playerName: string;
        roundOver: boolean;
        isGameOver: boolean;
    },
    broadCastPlayedMoveData?: any;
    broadCastNextTurnData?: any;
    broadCastGameOverData?: any;
    table: Table;
    errorData?: any
}

type ErrorData = {
    success: boolean;
    tableId?: string;
    info: string
}

// The 'processMove' function handles a player's move in the game.
// It processes the move through a series of steps (pipeline), updates the game state, 
// and finally broadcasts the result to the relevant clients

export async function processMove(data: MakeMovePayload) {

    let arr: Task<MakeMovePayload>[] = [getTableDataFromDb, initData, ifMoveValid, validatePlayer, ifMoveAllowed, performPlayerMove, performDealerMove];

    // Create a pipeline to process the tasks in the 'arr' array
    let pipeline = (new Pipeline<MakeMovePayload>());
    
    // Adding each task (function) to the pipeline
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });

        // Initialize the processedData object, which will hold the data to be broadcast
    data.processedData = {
        data: {
            index: -1,
            roundOver: false,
            isGameOver: false,
            playerName: "",
            chips: 0,
            amount: 0,
            originAmount: 0,
            considerAmount: 0,
            action: null,
            isCurrentPlayer: false,
            playerId: "",
        },
        errorData: {},
        table: null
    };

    let catchedError: any = null;

    // Run the pipeline, which processes each task one after another.
    // If any task fails, the error is caught and handled
    let res = await pipeline.run(data).catch(e => { console.log("exception in process move"); catchedError = e; });

    // If the pipeline successfully completed, proceed with the next steps
    if (!!res) {
        let res = await replaceTableToDb(data.processedData.table);
        if (res.success) {

            // If database update was successful, proceed to broadcast the game state changes
            // Optionally, you might want to clear existing timers (if used in the game)
            // clearExistingTimers(data.room as GameRoom)
            console.log("process move completed");
            sendTurnFlowBroadcasts(data.room, { isCurrentPlayer: data.processedData.data.isCurrentPlayer, turnData: { isGameOver: data.processedData.data.isGameOver, turn: data.processedData.broadCastTurnData }, gameOverBroadCasts: data.processedData.broadCastGameOverData }, data.tableId, data.processedData.table);
            return { success: true };
        } else {
            return res;
        }
    } else {
                // If the pipeline failed, handle the error accordingly
        if (catchedError.processedData?.errorData?.success) {
            let res = await replaceTableToDb(data.processedData.table);
            if (res.success) {
                console.log("replace table when game over etc");
                return { success: true };
            } else {
                // If DB update fails, return the failure result
                return res;
            }
        } else {
            if (!!data.processedData.table) {
                let id = data.processedData.table?.id;
                await forceUnlockTable(id);
            }
            console.log("process move exception", catchedError);
        }
    }


}

async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => {
        console.log(e)
    });
    if (!modTable) {

        let errorData = { success: false, info: "table couldnt be updated after move logic" };
        return errorData;
    }

    return { success: true };
}

let getTableDataFromDb = new Task<MakeMovePayload>(async (input: MakeMovePayload, resolve, reject) => {
    
    let table = await LockerHelper.getTable(input.tableId, "MoveProcess").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
});

let initData = new Task<MakeMovePayload>(async (input: MakeMovePayload, resolve, reject) => {
    //if Dealer Move then Skipping this
    if (input.isDealerMove) {
        resolve(input)
    } else {
        let table = input.processedData.table;
        input.processedData.data.index = table.currentInfo.players.findIndex((player: { playerId: string; state: PlayerState; }) => player.playerId === input.playerId && player.state === PlayerState.Playing);
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

        input.processedData.data.playerName = table.currentInfo.players[input.processedData.data.index].playerName;

        input.processedData.data.action = input.action;
        input.processedData.data.roundOver = false;
        input.processedData.data.isGameOver = (table.currentInfo.state === GameState.Over);
        input.processedData.data.chips = table.currentInfo.players[input.processedData.data.index].chips;
        input.processedData.data.amount = Math.trunc(input.actionPayload?.bet) || 0;
        input.processedData.data.originAmount = Math.trunc(input.actionPayload?.bet) || 0;
        input.processedData.data.considerAmount = input?.actionPayload?.bet || 0;
        input.processedData.data.isCurrentPlayer = true;
        input.processedData.data.playerId = input.playerId;
        resolve(input);
    }
});

// This task is responsible for validating if the player's move is allowed.
// It checks if the action the player is trying to perform is a valid move, based on the game rules.
let ifMoveValid = new Task<MakeMovePayload>((input: MakeMovePayload, resolve, reject) => {

    // Check if the current move is not a dealer's move
    if (!input.isDealerMove) {
        if (Object.values(PlayerMove).includes(input.action as PlayerMove)) {
            resolve(input);
        } else {

            // If the action is not valid, set an error in the processed data and reject the task
            let ed = ({ success: false, tableId: (input.tableId || ""), info: input.action + " is not a valid move" });
            
            // Add the error data to the processedData object for later use
            input.processedData.errorData = ed;
            reject(input);
        }
    } else {
        // If it's the dealer's move, no validation is needed, so simply resolve the input
        resolve(input)
    }
});

//check if player who sent request has current move index set. ie is valid to make a move. and current Hand Set
let validatePlayer = new Task<MakeMovePayload>(async (input: MakeMovePayload, resolve, reject) => {
    if (!input.isDealerMove) {
        if (input.processedData.data.index >= 0) {
            let table = input.processedData.table;
            let data = input.processedData.data;
            if (table.currentInfo.currentMoveIndex != -1 && table.currentInfo.players[data.index]?.seatIndex === table.currentInfo.players[table.currentInfo.currentMoveIndex]?.seatIndex) {
                resolve(input);
            } else {
                input.processedData.errorData = { success: false, info: "You are not a valid player to take action!" };
                reject(input);
            }
        } else {
            input.processedData.errorData = { success: false, info: "You are not seated on the table. Cant make a move" };
            reject(input);
        }

        
    } else {
        resolve(input)
    }
});

// ###  Validate if current move is allowed for this player 
let ifMoveAllowed = new Task<MakeMovePayload>((input: MakeMovePayload, resolve, reject) => {
    if (!input.isDealerMove) {
        let table: Table = input.processedData.table;
        let player: InGamePlayer = table.currentInfo.players[table.currentInfo.currentMoveIndex]
        const playedPosition: keyof HandInfo = input.actionPayload.playedPosition as keyof HandInfo
        let handInfoOfPlayedPosition: HandInfoDetail = (player.handInfo[playedPosition]) as HandInfoDetail;
        let availableActions = handInfoOfPlayedPosition.availableActions as any;
        let action = input.action.toLocaleLowerCase();
        if (!availableActions[action]) {
            let ed: ErrorData = ({ success: false, tableId: (input.tableId || ""), info: `${input.action} is not allowed here.` });
            input.processedData.errorData = ed;
            reject(input)
        } else {
            clearExistingTimers(input.room as GameRoom);
            resolve(input);
        }
    } else {
        resolve(input)
    }
});

//perform player Different Moves
let performPlayerMove = new Task<MakeMovePayload>(async (input: MakeMovePayload, resolve, reject) => {
    if (!input.isDealerMove) {
        let response: any = {};

  // Switch on the player's action and call the respective function to handle it.

        switch (input.action) {
            case PlayerMove.Hit: {
                response = await playerHit(input);
                break;
            }
            case PlayerMove.Stand: {
                response = await playerStand(input);
                break;
            }
            case PlayerMove.Split: {
                response = playerSplit(input);
                break;
            }
            case PlayerMove.Double: {
                response = await playerDouble(input)
                break;
            }
            default: {
                //deal or bet case

                break;
            }
        }
        input.processedData.table = response.table;
        input.processedData.broadCastTurnData = {
            currentMoveData: response.currentMoveData,
            nextTurnData: response.turnData,
            isDealerMove: response.isDealerMove
        }
        input.processedData.data.isGameOver = response.isGameOver || false;
        resolve(input)
    } else {
        resolve(input)
    }
});


// This task processes the dealer's move. It ensures that the dealer performs its move only if it's their turn,
// and updates the game state accordingly. It also handles asynchronous operations involved in processing the dealer's move.
let performDealerMove = new Task<MakeMovePayload>(async (input: MakeMovePayload, resolve, reject) => {
    if (input.isDealerMove) {
        input.processedData.data.isCurrentPlayer = true;
        let dealerMoveResponse = await handleDealerMove(input);
        if (dealerMoveResponse !== undefined) {
            resolve(input)
        }
    }
    resolve(input);
});

async function handleDealerMove(input: MakeMovePayload): Promise<void> {
    const table: Table = input.processedData.table;
    const dealer: Dealer = table.currentInfo.dealer;
    const deck = table.currentInfo.deck;

    //insurance case can be removed From here
    if (!dealer.isHoldCardOpened || input.action === 'holdCardOpen') {
        const response = await handleHoldCardOpening(input, table, dealer);
        return response;

    } else if (input.action === PlayerMove.Hit) {
        const response = await dealerHit(input, table, dealer, deck);
        return response;
    } else {
        const response = await dealerStand(input, table, dealer);
        return response;
    }
}

async function handleHoldCardOpening(input: MakeMovePayload, table: Table, dealer: Dealer): Promise<any> {
    const holdCard = dealer.holdCard;
    dealer.hand = dealer.hand.concat(holdCard);
    const dealerPoints = engine.calculate(dealer.hand);
    dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
    const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
    dealer.isBusted = dealerHigherValidValue > 21;
    dealer.isVisible = true;
    dealer.isHoldCardOpened = true;
    dealer.totalPoints = dealerPoints;
    let resp: any = {}
    let currentMoveData: any = {
        isDealerMove: true,
        action: "holdCardOpen",
        dealerPoints,
        handInfo: dealer.hand,
        hasBlackjack: dealer.hasBlackjack,
        isBusted: dealer.isBusted,
        handValue: dealerPoints
    }


    if (dealer.isBusted || dealer.hasBlackjack || dealerHigherValidValue >= 21) {//game Over Case
        table.currentInfo.state = GameState.Over;
        let payload = {
            processedData: {
                data: {},
                table: table,
            }
        }
        //check this again
        const response = await processGameOver(payload as GameOverPayload)//add more code
        if (response.success) {
            input.processedData.data.isGameOver = true;
            resp.isGameOver = true;
            resp.broadcastGameOverData = response.data.gameOverResponse;
        }
        input.processedData.table = table;
        input.processedData.broadCastTurnData = {
            currentMoveData: currentMoveData,
            nextTurnData: {},
            isDealerMove: false
        }
        input.processedData.broadCastGameOverData = resp.broadcastGameOverData;
        return resp as any;
    } else if (dealerPoints.hi < 17 || (dealerPoints.hi === 17 && (dealerPoints.hi != dealerPoints.lo))) {
        let turnData: any = {
            isDealerMove: true,
            seatIndex: -1,//in case of Dealer it will be -1 always
            player: null,//in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: 'right',
            nextDecidedActionForDealer: "Hit"
        }
        resp = {
            ...resp,
            table,
            currentMoveData,
            turnData
        };
        input.processedData.table = table;
        input.processedData.data.isGameOver = false;
        input.processedData.broadCastTurnData = {
            isDealerMove: input.isDealerMove,
            currentMoveData: resp.currentMoveData,
            nextTurnData: resp.turnData
        }
        return resp;
    } else {
        let turnData: any = {
            isDealerMove: input.isDealerMove,
            seatIndex: -1,//in case of Dealer it will be -1 always
            player: null,//in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: 'right',
            nextDecidedActionForDealer: "Stand"
        }
        resp = {
            ...resp,
            table,
            currentMoveData,
            turnData
        };
        input.processedData.table = table;
        input.processedData.data.isGameOver = false;
        input.processedData.broadCastTurnData = {
            isDealerMove: input.isDealerMove,
            currentMoveData: resp.currentMoveData,
            nextTurnData: resp.turnData
        }

        return resp;
    }
}

async function dealerHit(input: MakeMovePayload, table: Table, dealer: Dealer, deck: any): Promise<any> {
    const card = popCard(deck, 1);
    dealer.hand = [...dealer.hand, card[0]];
    const dealerPoints = engine.calculate(dealer.hand);
    dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
    const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
    dealer.isBusted = dealerHigherValidValue > 21;
    dealer.totalPoints = dealerPoints;
    let resp: any = {}
    let currentMoveData: any = {
        isDealerMove: true,
        action: "Hit",
        popCard: card,
        handValue: dealerPoints,
        handInfo: dealer.hand,
        hasBlackjack: dealer.hasBlackjack,
        isBusted: dealer.isBusted
    }
    if (dealer.isBusted || dealer.hasBlackjack || (dealerHigherValidValue >= 21)) {
        table.currentInfo.state = GameState.Over;
        let payload = {
            processedData: {
                data: {},
                table: table,
            }
        }
        //check this again
        const response = await processGameOver(payload as GameOverPayload)//add more code
        if (response.success) {
            input.processedData.data.isGameOver = true;
            resp.isGameOver = true;
            resp.broadcastGameOverData = response.data.gameOverResponse;
        }
        input.processedData.table = table;
        input.processedData.broadCastTurnData = {
            currentMoveData: currentMoveData,
            nextTurnData: {},
            isDealerMove: false
        }
        input.processedData.broadCastGameOverData = resp.broadcastGameOverData;
        return resp as any;
    } else if (dealerPoints.hi < 17 || (dealerPoints.hi === 17 && (dealerPoints.hi != dealerPoints.lo))) {
        let turnData: any = {
            isDealerMove: input.isDealerMove,
            seatIndex: -1,//in case of Dealer it will be -1 always
            player: null,//in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: 'right',
            nextDecidedActionForDealer: "Hit"
        }
        resp = {
            ...resp,
            table,
            currentMoveData,
            turnData
        };
        input.processedData.table = table;
        input.processedData.data.isGameOver = false;
        input.processedData.broadCastTurnData = {
            isDealerMove: input.isDealerMove,
            currentMoveData: resp.currentMoveData,
            nextTurnData: resp.turnData
        }
        return resp;
    } else {
        let turnData: any = {
            isDealerMove: input.isDealerMove,
            seatIndex: -1,//in case of Dealer it will be -1 always
            player: null,//in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: 'right',
            nextDecidedActionForDealer: "Stand"
        }
        resp = {
            ...resp,
            table,
            currentMoveData,
            turnData
        };
        input.processedData.table = table;
        input.processedData.data.isGameOver = false;
        input.processedData.broadCastTurnData = {
            isDealerMove: input.isDealerMove,
            currentMoveData: resp.currentMoveData,
            nextTurnData: resp.turnData
        }

        return resp as any;

    }
}

async function dealerStand(input: MakeMovePayload, table: Table, dealer: Dealer): Promise<void> {
    const dealerPoints = engine.calculate(dealer.hand);
    dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
    const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
    dealer.isBusted = dealerHigherValidValue > 21;
    dealer.totalPoints = dealerPoints;
    let resp: any = {}

   
    table.currentInfo.state = GameState.Over;
    let payload = {
        processedData: {
            data: {},
            table: table,
        }
    }
    //check this again
    const response = await processGameOver(payload as GameOverPayload)//add more code
    if (response.success) {
        input.processedData.data.isGameOver = true;
        resp.isGameOver = true;
        input.processedData.broadCastGameOverData = response.data.gameOverResponse;
        resp.broadCastGameOverData = response.data.gameOverResponse;
    }

    let currentMoveData: any = {
        isDealerMove: true,
        action: "Stand",
        handValue: dealerPoints,
        handInfo: dealer.hand,
        hasBlackjack: dealer.hasBlackjack,
        isBusted: dealer.isBusted
    }
    resp = {
        ...resp,
        table,
        currentMoveData,
        nextTurnData: {}
    }

    input.processedData.table = table;
    input.processedData.broadCastTurnData = {
        isDealerMove: false,
        currentMoveData: resp.currentMoveData,
        nextTurnData: {},
    }

    return resp as any;
}


async function playerHit(input: MakeMovePayload): Promise<any> {
    // Initialize response object
    let resp: any = {};

    // Extract necessary data from input
    let table: Table = input.processedData.table;
    let player: InGamePlayer = table.currentInfo.players[input.processedData.data.index];
    const playedPosition: keyof HandInfo = input.actionPayload.playedPosition as keyof HandInfo
    let handInfo: HandInfo = player.handInfo;
    const dealer: Dealer = table.currentInfo.dealer;
    let playerHistory = player.history;
    let deck = table.currentInfo.deck;

    // Prepare data for current move
    let currentMoveData: any = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: input.action,
        playedPosition,
        seatIndex: player.seatIndex
    }
    //pop card first
    const card = popCard(deck, 1);

    // Determine if the player has split previously
    const hasSplit = playerHistory.some(x => x.type === PlayerMove.Split)

    let playerCards = [];
    let left = {} as HandInfoDetail;
    let right = {} as HandInfoDetail;
    const action: any = {
        type: input.action,
        playedPosition: playedPosition
    }
    //in case of split player has two hand left and right
    // Calculate new hand information after hitting
    if (playedPosition === 'left') {
        playerCards = handInfo.left.cards.concat(card);
        left = engine.getHandInfoAfterHit(playerCards, dealer.hand, handInfo.left.initialBet, hasSplit) as HandInfoDetail;
        right = Object.assign({}, handInfo.right);
        action.cards = playerCards;
        action.handValue = left.handValue;
        left.initialBet = handInfo.left.initialBet;
        action.amount = left.initialBet;
        

    } else {
        playerCards = handInfo.right.cards.concat(card)
        right = engine.getHandInfoAfterHit(playerCards, dealer.hand, handInfo.right.initialBet, hasSplit)
        left = Object.assign({}, handInfo.left);
        right.initialBet = handInfo.right.initialBet;
        action.cards = playerCards;
        action.handValue = right.handValue;
        action.amount = right.initialBet;
        
    }
    if (hasSplit) {
        //no moresplit if already occured
        left.availableActions.split = false;
        right.availableActions.split = false
    } else {
        //include other edge case
    }
    const objCards: any = {}
    objCards[playedPosition] = playerCards
    const historyItem = appendEpoch({
        ...action,
        ...objCards
    })
    handInfo.left = left;
    handInfo.right = right;
    currentMoveData = {
        ...currentMoveData,
        handInfo,
        popCard: card,
    }
    player.handInfo = handInfo;
    player.history.push(historyItem);
    table.currentInfo.players[input.processedData.data.index] = player;

    const findTurnResponse = findTurnForPlayers(table, playedPosition, false);
    console.log('findTurnResponse inside playerHit :: ', table)

    resp.table = table;
    resp.currentMoveData = currentMoveData;
    table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
    const playerDataTosend: any = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
    let dataToSend = {}
    if (Object.keys(playerDataTosend).length){dataToSend = {
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
    let turnData = {
        isDealerMove: findTurnResponse.isDealerMove,
        seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex,//in case of Dealer it will be 0 always
        player: findTurnResponse.isDealerMove ? null : dataToSend,//in case of dealer it will be null
        dealer: table.currentInfo.dealer,
        currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        
    }
    resp.turnData = turnData;
    resp.isGameOver = false;
    if (findTurnResponse.isDealerMove) {
        // possible case of gameOver in case of all busted
        const gameOverResponse = checkAllHands(table);
        if (gameOverResponse) {
            //game Over Occur changing table State
            input.processedData.table.currentInfo.state = GameState.Over;
            let payload = {
                processedData: {
                    data: {},
                    table: input.processedData.table,
                }
            }
            const response = await processGameOver(payload as GameOverPayload)//add more code
            if (response.success) {
                resp.isGameOver = true;
                resp.broadCastGameOverData = response.data.gameOverResponse
                input.processedData.broadCastGameOverData = response.data.gameOverResponse;
                resp.turnData = {}
            }
        } else {
            resp.turnData.nextDecidedActionForDealer = findTurnResponse.isDealerMove ? 'holdCardOpen' : ''
        }
    }
    input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
    return resp;

}

// Checks if all players in the game have busted hands
function checkAllHands(table: Table): boolean {
    // Iterate through each player in the current game.
    for (const player of table.currentInfo.players) {
        if (player.state === PlayerState.Playing || (player.state === PlayerState.Disconnected && player.active === true)) {
            const handInfo = player.handInfo;
            const hasSplit = player.history.some((x) => x.type === PlayerMove.Split);
            if (hasSplit) {
                const leftBusted = handInfo.left.hasBusted;
                const rightBusted = handInfo.right.hasBusted;

                // If either the left or right hand is not busted, return false.
                // This means not all of the player's hands are busted.
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


/**
 * Handles the player's decision to stand in the game.
 * This function updates the player's hand information, processes the player's action,
 * and updates the game state accordingly. **/
async function playerStand(input: MakeMovePayload): Promise<any> {
    let resp: any = {}
    let table: Table = input.processedData.table;
    let player: InGamePlayer = table.currentInfo.players[input.processedData.data.index];
    const playedPosition: keyof HandInfo = input.actionPayload.playedPosition as keyof HandInfo
    let handInfo: HandInfo = player.handInfo;
    const dealer: Dealer = table.currentInfo.dealer;
    let playerHistory = player.history;
    let deck = table.currentInfo.deck;
    let playerCards = []
    let left = {} as HandInfoDetail
    let right = {} as HandInfoDetail
    const action: any = {
        type: input.action,
        playedPosition: playedPosition
    }
    let currentMoveData: any = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: input.action,
        playedPosition,
        seatIndex: player.seatIndex
    }
    if (playedPosition === 'left') {
        left = engine.getHandInfoAfterStand(handInfo.left)
        right = Object.assign({}, handInfo.right)
        playerCards = left.cards
        left.initialBet = handInfo.left.initialBet;
        action.card = left.cards;
        action.handValue = left.handValue;
        action.amount = left.initialBet
        // no more move on this position
    } else {
        left = Object.assign({}, handInfo.left)
        right = engine.getHandInfoAfterStand(handInfo.right)
        playerCards = right.cards
        right.initialBet = handInfo.right.initialBet;
        action.cards = right.cards;
        action.handValue = right.handValue;
        action.amount = right.initialBet;
    }

    //validation for available actions
    //to Do
    const objCards: any = {}
    objCards[playedPosition] = playerCards
    const historyItem = appendEpoch({
        ...action,
        ...objCards
    })
    currentMoveData = {
        ...currentMoveData,
        handInfo,
        popCard: {},
    }
    handInfo.left = left;
    handInfo.right = right;
    player.handInfo = handInfo;
    player.history.push(historyItem);
    table.currentInfo.players[input.processedData.data.index] = player;

    const findTurnResponse = findTurnForPlayers(table, playedPosition, false);
    console.log('findTurnResponse inside playerStand :: ', table)

    resp.table = table;
    resp.currentMoveData = currentMoveData;
    table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
    const playerDataTosend: any = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
    let dataToSend = {}
    if (Object.keys(playerDataTosend).length){dataToSend = {
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
    let turnData = {
        isDealerMove: findTurnResponse.isDealerMove,
        seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex,//in case of Dealer it will be 0 always
        player: findTurnResponse.isDealerMove ? null : dataToSend,//in case of dealer it will be null
        dealer: table.currentInfo.dealer,
        currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        
    }

    resp.turnData = turnData;
    if (findTurnResponse.isDealerMove) {
        resp.turnData.nextDecidedActionForDealer = 'holdCardOpen'
    }
    resp.isGameOver = false;
    input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
    return resp;
}

async function playerDouble(input: MakeMovePayload): Promise<any> {
    let resp: any = {}
    let table: Table = input.processedData.table;
    let player: InGamePlayer = table.currentInfo.players[input.processedData.data.index];
    const playedPosition: keyof HandInfo = input.actionPayload.playedPosition as keyof HandInfo
    let handInfo: HandInfo = player.handInfo;
    const dealer: Dealer = table.currentInfo.dealer;
    let playerHistory = player.history;
    let deck = table.currentInfo.deck;
    let stage = ''
    const card = popCard(deck, 1);
    player.chips = player.chips - player.initialBet;
    let playerCards = []
    let left = {} as HandInfoDetail
    let right = {} as HandInfoDetail
    const hasSplit = playerHistory.some(x => x.type === PlayerMove.Split)
    const action: History = {
        type: input.action as PlayerMove,
        playedPosition: playedPosition,
        card: [],
        amount: 0,
        handValue: {
            hi: 0,
            lo: 0
        }
    }

    let currentMoveData: any = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: input.action,
        playedPosition,
        seatIndex: player.seatIndex
    }
    if (playedPosition === 'left') {
        right = Object.assign({}, handInfo.right)
        playerCards = handInfo.left.cards.concat(card)
        left = engine.getHandInfoAfterDouble(playerCards, dealer.hand, player.initialBet, hasSplit)
        left.initialBet = handInfo.left.initialBet * 2;
        action.card = playerCards;
        action.handValue = left.handValue;
        action.amount = left.initialBet;
    } else {
        playerCards = handInfo.right.cards.concat(card)
        left = Object.assign({}, handInfo.left)
        right = engine.getHandInfoAfterDouble(playerCards, dealer.hand, player.initialBet, hasSplit);
        action.card = playerCards;
        right.initialBet = handInfo.right.initialBet * 2;
        action.handValue = right.handValue;
        action.amount = right.initialBet;
    }
    handInfo.left = left;
    handInfo.right = right;
    player.handInfo = handInfo;
    const objCards: any = {}
    objCards[playedPosition] = playerCards
    const historyItem = appendEpoch({
        ...action,
        payload: { bet: player.initialBet },
        ...objCards
    })
    currentMoveData = {
        ...currentMoveData,
        handInfo,
        popCard: card,
    }
    player.history.push(historyItem);
    player.totalBetOnTable += player.initialBet;
    table.currentInfo.players[input.processedData.data.index] = player;

    const findTurnResponse = findTurnForPlayers(table, playedPosition, false);
    console.log('findTurnResponse inside playerDouble :: ', table)

    resp.table = table;
    resp.currentMoveData = currentMoveData;
    table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
    const playerDataTosend: any = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
    let dataToSend = {}
    if (Object.keys(playerDataTosend).length){dataToSend = {
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
    let turnData = {
        isDealerMove: findTurnResponse.isDealerMove,
        seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex,//in case of Dealer it will be 0 always
        player: findTurnResponse.isDealerMove ? null : dataToSend,//in case of dealer it will be null
        dealer: table.currentInfo.dealer,
        currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        
    }
    resp.turnData = turnData;
    resp.isGameOver = false;

    if (findTurnResponse.isDealerMove) {
        // possible case of gameOver in case of all busted
        const gameOverResponse = checkAllHands(table);
        if (gameOverResponse) {
            input.processedData.table.currentInfo.state = GameState.Over;
            let payload = {
                processedData: {
                    data: {},
                    table: input.processedData.table,
                }
            }
            const response = await processGameOver(payload as GameOverPayload)//add more code
            if (response.success) {
                resp.isGameOver = true;
                input.processedData.data.isGameOver = true;
                input.processedData.broadCastGameOverData = response.data.gameOverResponse;
                resp.broadCastGameOverData = response.data.gameOverResponse
            }

        } else {
            resp.turnData.nextDecidedActionForDealer = findTurnResponse.isDealerMove ? 'holdCardOpen' : ''
        }
    }
    input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
    return resp;
}

function playerSplit(input: MakeMovePayload): any {
    let resp: any = {}
    let table: Table = input.processedData.table;
    let player: InGamePlayer = table.currentInfo.players[input.processedData.data.index];
    const playedPosition: keyof HandInfo = input.actionPayload?.playedPosition as keyof HandInfo || null;
    let handInfo: HandInfo = player.handInfo;
    const dealer: Dealer = table.currentInfo.dealer;
    let playerHistory = player.history;
    let deck = table.currentInfo.deck;

    const playerCardsLeftPosition = [handInfo.right.cards[0]]
    const playerCardsRightPosition = [handInfo.right.cards[1]]
    
    const action = {
        type: input.action,
        playedPosition: playedPosition
    }
    let currentMoveData: any = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: input.action,
        playedPosition,
        seatIndex: player.seatIndex
    }
    let left = engine.getHandInfoAfterSplit(playerCardsLeftPosition, dealer.hand, player.initialBet);
    left.initialBet = player.initialBet;
    let right = engine.getHandInfoAfterSplit(playerCardsRightPosition, dealer.hand, player.initialBet);
    right.initialBet = player.initialBet;
    const historyItem = appendEpoch({
        ...action,
        payload: { bet: player.initialBet },
        left: playerCardsLeftPosition,
        right: playerCardsRightPosition
    })
    player.history.push(historyItem);
    //deduct chips and it's broadcast
    player.chips = player.chips - player.initialBet;
    player.initialBet = player.initialBet * 2;
    player.totalBetOnTable += player.initialBet;
    

    handInfo.left = left;
    handInfo.right = right;

    currentMoveData = {
        ...currentMoveData,
        handInfo,
        
    }

    table.currentInfo.players[input.processedData.data.index] = player;

    const findTurnResponse = findTurnForPlayers(table, playedPosition, false);
    console.log('findTurnResponse inside playerSplit :: ', table)
    resp.table = table;
    resp.currentMoveData = currentMoveData;
    table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
    const playerDataTosend: any = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
    let dataToSend = {}
    if (Object.keys(playerDataTosend).length){dataToSend = {
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
    let turnData = {
        isDealerMove: findTurnResponse.isDealerMove,
        seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex,//in case of Dealer it will be 0 always
        player: findTurnResponse.isDealerMove ? null : dataToSend,//in case of dealer it will be null
        dealer: table.currentInfo.dealer,
        currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        
    }
    resp.turnData = turnData;
    resp.isGameOver = false;
    input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
    return resp;
}


function popCard(deck: any[], count: number) {
    let cards = deck.slice(0, count);
    deck.splice(0, count);
    return cards;
}

const appendEpoch = (obj: any) => {
    const { payload = { bet: 0 } } = obj
    return Object.assign(
        {},
        obj,
        {
            value: payload.bet || 0,
            ts: new Date().getTime()
        }
    )
}



export async function sendTurnFlowBroadcasts(room: Room, response: any, tableId: string, table: Table) {

    if (response.isCurrentPlayer) {
        setTimeout(function () {
            console.log('onturn from turn helper 1.1')
            dispatchOnTurnBroadcast(room, response.turnData);
        }, (500));
       
        // Send player turn broadcast to channel level
        if (!response.turnData.isGameOver && !response.turnData?.turn?.nextTurnData.isDealerMove) {
            //for now not for Dealer Move

            startTurnTimer({ room: room as GameRoom, table: table, isTurnTime: true });
        } else {
            //.error, 'Not starting channel turn timer and resetting previous ones as Game is over now!');
            if (!response.turnData?.turn?.nextTurnData?.isDealerMove)
                clearExistingTimers(room as GameRoom)
        }
    }
    if (response.isCurrentPlayer) {
        if (response.turnData?.turn?.nextTurnData.isDealerMove && !response.turnData.isGameOver) {
           
            let movePayload = {
                room,
                tableId,
                isDealerMove: true,
                action: response.turnData.turn.nextTurnData.nextDecidedActionForDealer
            }
            setTimeout(function () {
                console.log('process move called from move Helper')
                processMove(movePayload)
                    .then(() => {
                        isProcessingMove = false; // Reset the flag after the move is processed
                    })
                    .catch(error => {
                        console.error("Error processing move:", error);
                        isProcessingMove = false; // Reset the flag in case of an error
                    });
            }, 2000);
            // }
        }
    }

    if (response.turnData.isGameOver) {
        if (response.gameOverBroadCasts?.dealerHoldCardDistributeBroadCast) {
            const dealer=response.gameOverBroadCasts.dealer
            const holdCard = dealer.holdCard;
            dealer.hand = dealer.hand.concat(holdCard);
            const dealerPoints = engine.calculate(dealer.hand);
            dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
            const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
            dealer.isBusted = dealerHigherValidValue > 21;
            dealer.isVisible = true;
            dealer.isHoldCardOpened = true;
            dealer.totalPoints = dealerPoints;
            const currentMoveData: any = {
                isDealerMove: true,
                action: "holdCardOpen",
                dealerPoints,
                handInfo: dealer.hand,
                hasBlackjack: dealer.hasBlackjack,
                isBusted: dealer.isBusted,
                handValue: dealerPoints
            };

            let broadCastTurnData = {
                currentMoveData: currentMoveData,
                nextTurnData: {},
                isDealerMove: false
            }
            let turnData = { isGameOver: true, turn: broadCastTurnData }
            setTimeout(function () {
                console.log('onturn from turn helper 1.2')
                dispatchOnTurnBroadcast(room, turnData);
            }, (300));
        }
        setTimeout(function () {
            dispatchGameOverBroadcast(room, { playersResult: response.gameOverBroadCasts.playersResult, dealer: response.gameOverBroadCasts.dealer })
        }, (3000));

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

    //  If leave broadcast is prsent then handle leave additional events
    if (!!response.turnData.leaveBroadcast) {
        if (!!response.turnData.leaveBroadcast.clearTimer) {
            clearExistingTimers(room as GameRoom);
        }
        dispatchLeaveBroadcast(room, response.turnData.leaveBroadcast);
        if (!!response.turnData.feedBackDataToIvoree) {
            if (!!response.turnData.feedBackDataToIvoree && !!response.turnData.feedBackDataToIvoree.playerId) {
                const feedBackDataToIvoree = response.turnData.feedBackDataToIvoree;
                const player = await findUser({ playerId: response.turnData.feedBackDataToIvoree.playerId });
                const startDateTime:any = new Date(player.loginInfo.lastLogin);
                const endDateTime:any = new Date();

                // Calculate the difference in milliseconds
                const timeDifferenceMs = endDateTime - startDateTime;

                // Convert milliseconds to minutes
                const totalPlayMinutes = Math.round(timeDifferenceMs / (1000 * 60));
                const dataToSend: any = {
                    casinoTenentId: player.casinoTenentId,
                    playerID: player.playerId,
                    acct: null,
                    game: "BlackJack",
                    is_tournament: false,
                    speed: null,
                    ref_tranid: null,
                    remarks: null,
                    tusks_in: Math.trunc(feedBackDataToIvoree.chipsIn) || 0,
                    bet: Math.trunc(feedBackDataToIvoree.totalBetInGame) || 0,
                    descry_tusks_in: 0.0,
                    tusks_out: Math.trunc(feedBackDataToIvoree.chipsOut) || 0,
                    play_starttime_utc: player.loginInfo.lastLogin,
                    play_endtime_utc: new Date().toISOString(),
                    total_play_minutes: totalPlayMinutes
                }
                console.log("data to send", JSON.stringify(dataToSend));
                const bearerToken = player.loginInfo.callback_token.substring("Bearer".length + 1);
                
                const callbackUrl = player.loginInfo.callback_url+'/api/BG/player/rating';

                console.log(callbackUrl)
                const axiosConfig = {
                    headers: {
                        'Authorization': `Bearer ${bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                };
                
            }

        }
    }

}