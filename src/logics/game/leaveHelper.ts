import * as LockerHelper from './LockTable/LockerHelper';

import { Card, GameState, PlayerState } from "./types";
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { fetchTable, findPlayerOnTableJoinRecord, forceUnlockTable, removePlayerJoin, replaceTable } from "../../db/Queries";

import { DbManager } from "../../db/DbManager";
import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { PlayerMove } from "./gameConstants";
import { Room } from "colyseus";
import { SchedulerHelper } from "./SchedulerHelper";
import { Table } from "../../dataFormats/table";
import { addChips } from "./chipsManagement";
import { pluck } from "underscore";
import { sendTurnFlowBroadcasts } from "./moveHelper";
import { updateUser } from "../../db/masterQueries";

export type LeavePayload = {
    playerId: string;
    tableId: string;
    isStandUp?: boolean;
    playerName?: string;
    isRequested?: boolean;
    processedData?: {
        table: Table;
        data: {
            feedBackDataToIvoree: { chipsIn: number; totalBetInGame: number; chipsOut: number; playerId: string };
            clearTimer: boolean;
            action: string;
            index: number;
            origin?: string;
            leaveResponse?: any;
            state: any;

            isCurrentPlayer?: boolean;
            roundOver?: boolean;
            isGameOver?: boolean;
            chips?: number;
            amount?: 0;
            pot?: any;
            currentBoardCard?: any[];
            isSeatsAvailable?: boolean;


            roundOverData?: any;

            rakeDistributionResult?: any;
        },
        errorData?: any;
        updatedChips?: {
            realChips?: number,
            playChips?: number,
        }
    },
    room: Room
}

async function getTableDataFromDb(input: LeavePayload) {

    let table = await LockerHelper.getTable(input.tableId, "Leave").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        return false;
    }
    input.processedData.table = table;
    return true;
}

export async function leavePlayer(input: LeavePayload) {
    console.log("leave Called", { playerId: input.playerId });
    input.processedData = {
        table: null,
        data: {
            clearTimer:false,
            action: null,
            index: null,
            state: null,
            feedBackDataToIvoree: {
                chipsIn: 0,
                chipsOut: 0,
                totalBetInGame: 0,
                playerId: null,
            }
        },
    }

    let tableRes = await getTableDataFromDb(input);
    if (!tableRes) {
        console.log("error in fetching table while standing up");
        return
    }
    let table = input.processedData.table;

        let arr: Task<LeavePayload>[] = [setLeaveParams, validateAction, updateCareerRecord, refundAmountOnLeave, onLeaveSummary,
            removeFromTable, adjustActiveIndexes, generateResponse];

        let pipeline = (new Pipeline<LeavePayload>());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        let res = await pipeline.run(input).catch(e => { console.log("exception in leave player"); catchedError = e; });
        if (!!res) {
            let replaceRes = await replaceTableToDb(input.processedData.table);
            if (replaceRes.success) {
                sendLeaveAndTurnBroadcast(input);
                return ({ success: true, tableId: input.tableId });
            } else {
                return ({ success: false, tableId: input.tableId });
            }

        } else {
            console.log('Player leave process failed', { playerId: input.playerId, catchedError });
            await forceUnlockTable(input.tableId);//will integrate Db later

            console.log(catchedError)
            return ({ success: false, tableId: input.tableId, info: catchedError?.processedData.errorData.info });

        }
    // }
}

let setLeaveParams = new Task<LeavePayload>((input: LeavePayload, resolve, reject) => {
    input.processedData.data.action = input.isStandUp ? PlayerMove.StandUp : PlayerMove.Leave;
    input.processedData.data.index = input.processedData.table.currentInfo.players.findIndex((player: { playerId: string; }) => player.playerId === input.playerId);
    if (input.processedData.data.index >= 0) {
        let player = input.processedData.table.currentInfo.players[input.processedData.data.index];
        if (player.initialBet > 0) {
            let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to leave as you have placed Bet" });
            input.processedData.errorData = err;
            // logger.warn('Invalid stand up action for player', { playerId: input.playerId, error: err });
            reject(input);
        }
    }
    resolve(input);
});

// > Spectator player cannot opt to standup
let validateAction = new Task<LeavePayload>((input: LeavePayload, resolve, reject) => {
    // logger.info('Validating player action', { playerId: input.playerId, action: input.processedData.data.action });
    // Validate if this standup or leave is allowed for this player
    // check cases as listed (with exported function)
    function checkOrigin(input: LeavePayload) {
        if (input.processedData.data.origin) {
            if (input.processedData.data.origin == 'kickToLobby') {
                if (input.processedData.data.index < 0) {
                    return { success: true };
                } else {
                    return ({ success: false, tableId: input.tableId, info: 'Kick to lobby is only allowed for observer.' });
                }
            } else if (input.processedData.data.origin == 'vacantSeat') {
                if (input.processedData.data.index >= 0 && input.processedData.table.currentInfo.players[input.processedData.data.index].state == PlayerState.Reserved) {
                    return { success: true };
                } else {
                    if (input.processedData.data.index < 0) {
                        return { success: true };
                    } else {
                        return ({ success: false, tableId: input.tableId, info: 'Vacant reserved seat is only allowed for observer/ RESERVED sitting.' });
                    }
                }
            } else if (input.processedData.data.origin == 'tableIdleTimer') {
                if (input.processedData.table.currentInfo.state == GameState.Idle) {
                    return { success: true };
                } else {
                    return ({ success: false, tableId: input.tableId, info: 'Leave on idle table is only allowed when idle table.' });
                }
            } else if (input.processedData.data.origin == 'idlePlayer') {
                if (input.processedData.data.index >= 0 && input.processedData.table.currentInfo.players[input.processedData.data.index].state == PlayerState.OnBreak) {
                    return { success: true };
                } else {
                    if (input.processedData.data.index < 0) {
                        return { success: true };
                    } else {
                        return ({ success: false, tableId: input.tableId, info: 'Idle player removal is only allowed for observer/ ONBREAK sitting.' });
                    }
                }
            } else {
                return { success: true };
            }
        } else {
            return { success: true };
        }
    }
    if (input.processedData.data.index < 0 && input.processedData.data.action === PlayerMove.StandUp) {
        let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to stand up, please choose Leave." });
        input.processedData.errorData = err;
        // logger.warn('Invalid stand up action for player', { playerId: input.playerId, error: err });
        reject(input);
    } else {
        let res = checkOrigin(input);
        if (res.success) {
            resolve(input);
        } else {
            input.processedData.errorData = res;
            // logger.error('Player action validation failed', { playerId: input.playerId, error: res });
            reject(input);
        }
    }
});

//leaving it for future
let updateCareerRecord = new Task<LeavePayload>(async (input: LeavePayload, resolve, reject) => {

    resolve(input)
});

// Refund amount to player after leave
// refund only player.chips
let refundAmountOnLeave = new Task<LeavePayload>(async (input: LeavePayload, resolve, reject) => {
   
    if (input.processedData.data.index >= 0) {
        var chipsToRefund = input.processedData.table.currentInfo.players[input.processedData.data.index].chips;
        const totalBetInGame = input.processedData.table.currentInfo.players[input.processedData.data.index].totalBetOnTable;
        const chipsIn = input.processedData.table.currentInfo.players[input.processedData.data.index].chipsIn;
        let player=input.processedData.table.currentInfo.players[input.processedData.data.index];
        if (player.showContinueBetPopUp) {
            player.showContinueBetPopUp = false;
        }
        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }
        var instantBonusAmount = input.processedData.table.currentInfo.players[input.processedData.data.index].instantBonusAmount;
        if (player.initialBet > 0) {
            let err = ({ success: false, tableId: input.tableId, info: "You are not allowed to leave as you have placed Bet" });
            input.processedData.errorData = err;
            reject(input);
        }
        if (chipsToRefund > 0) {
            let payload = {
                playerId: input.playerId,
                chips: chipsToRefund,
                isRealMoney: input.processedData.table.info.isRealMoney,
                instantBonusAmount: instantBonusAmount,
                category: "Table Actions",
                subCategory: "Leave",
                tableName: input.processedData.table.info.name
            }
            let addChipsResponse = await addChips(payload);
            if (addChipsResponse.success) {
                if (input.processedData.table.info.isRealMoney) {
                    input.processedData.updatedChips = {
                        realChips: addChipsResponse.newBalance
                    }
                } else {
                    input.processedData.updatedChips = {
                        playChips: addChipsResponse.newBalance
                    }
                }
                input.processedData.data.feedBackDataToIvoree = {
                    chipsIn: chipsIn,
                    totalBetInGame: totalBetInGame,
                    chipsOut: chipsToRefund,
                    playerId: input.playerId,
                }
                resolve(input);
            } else {
                input.processedData.errorData = { success: false, info: "Refund money failed on leave" };
                reject(input);
            }
        } else {
            resolve(input);
        }
    } else {
        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }
        const playerOnTableJoinRecord = await findPlayerOnTableJoinRecord({ tableId: input.tableId, playerId: input.playerId });
        if (!!playerOnTableJoinRecord) {
            const totalBetInGame = 0;
            const chipsIn = playerOnTableJoinRecord.chipsIn;

            input.processedData.data.feedBackDataToIvoree = {
                chipsIn: chipsIn,
                totalBetInGame: totalBetInGame,
                chipsOut: chipsIn,
                playerId: input.playerId,
            }
        }
        resolve(input);
    }
});


async function createPassbookEntry(input: LeavePayload) {
    var passbookData = {
        time: Number(new Date()),
        prevAmt: "what after last add chip on table",
        category: "Table Actions",
        amount: 0,
        newAmt: "same as prevAmt",
        subCategory: "Leave",
        tableName: input.processedData.table.info.name
    };
    var query = { playerId: input.playerId };
    
};

// generate summary text on leave and add to params.table.summaryOfAllPlayers
let onLeaveSummary = new Task<LeavePayload>(async (input: LeavePayload, resolve, reject) => {
    if (input.processedData.data.state == PlayerState.Playing) {
    }
    resolve(input);
});

// Remove player object from player array on table
let removeFromTable = new Task<LeavePayload>(async (input: LeavePayload, resolve, reject) => {
    // logger.info('Initiating player removal from table', { playerId: input.playerId, tableId: input.tableId });
    if (input.processedData.data.index >= 0) {
        var removedPlayers = input.processedData.table.currentInfo.players.splice(input.processedData.data.index, 1); // splice returns removed elements array
        if (removedPlayers.length > 0) {
            input.processedData.table.currentInfo.vacantSeats += 1;
                  for (let i = 0; i < removedPlayers.length; i++) {
                let player = removedPlayers[i];
                await updatePlayerStatsToDb(player);
            }
        }
    }

    if (input.processedData.table.currentInfo.players.length === 0) {
        input.processedData.data.clearTimer = true;
        //meaning no players to play game reseting Table Here
        let table: Table = input.processedData.table;
        table.currentInfo.state = GameState.Idle;
        table.currentInfo.stateInternal = GameState.Idle;
        table.currentInfo.roundCount = table.currentInfo.roundCount + 1;
        table.info.maxBetAllowed = 0;//not used really anywhere much
        table.currentInfo.isOperationOn = false;
        table.currentInfo.isBettingRoundLocked = false;
        table.currentInfo.currentMoveIndex = -1;
        table.currentInfo.isInsuranceAsked = false;
        table.currentInfo.isInsurancePlacedOnTable = false;
        table.currentInfo._v = 1;

        let dealer = table.currentInfo.dealer;
        dealer.hand = [];
        // dealer.holdCard = {};
        dealer.holdCard  = null ;

        dealer.isHoldCardOpened = false;
        dealer.totalPoints = { hi: 0, lo: 0 };
        dealer.isSoft17 = false;
        dealer.isBusted = false;
        dealer.hasBlackjack = false;
        dealer.isVisible = false;
        table.currentInfo.dealer = dealer;

    }

    // todos below commented stuff
    //will do it later as per requirment
    if (input.isStandUp) {
    } else {
        let result = await removePlayerJoin({ tableId: input.tableId, playerId: input.playerId });
        SchedulerHelper.Instance.clearInactivePlayerJob(input.tableId, input.playerId);
        SchedulerHelper.Instance.clearPlayerPlaySession(input.tableId, input.playerId);
        SchedulerHelper.Instance.clearRemovePlayerJob(input.tableId, input.playerId);
        SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
    }

    resolve(input);
});

// ### Adjust active player indexes among each other
// > Set preActiveIndex and nextActiveIndex values for each player
// > Used for turn transfer importantly
let adjustActiveIndexes = new Task<LeavePayload>(async (input: LeavePayload, resolve, reject) => {
   
    resolve(input)
});

// generte response when player leave
// case > no game running on table
let generateResponse = new Task<LeavePayload>(async (input: LeavePayload, resolve, reject) => {
    const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
    const result = await tableJoinCollection.find({ tableId: input.tableId, isSpectator: true }).toArray();
    let spectatorPlayer: any[] = [];
    result && result.forEach((player) => {
        spectatorPlayer.push(player.playerId)
    })
    let data2 = {
        success: true,
        tableId: input.tableId,
        isGameOver: false,
        isCurrentPlayer: false,
        isRoundOver: false,
        playerLength: input.processedData.table.currentInfo.players.length,
        isSeatsAvailable: 3 !== input.processedData.table.currentInfo.players.length,
        leaveBroadcast: {
            success: true,
            clearTimer: input.processedData.data.clearTimer ? true : false,
            tableId: input.tableId,
            playerId: input.playerId,
            playerName: input.playerName,
            isStandUp: input.processedData.data.action === PlayerMove.StandUp,
            chips: {
                realChips: input.processedData.updatedChips?.realChips,
                playChips: input.processedData.updatedChips?.playChips
            },
            spectator: spectatorPlayer
        },
        feedBackDataToIvoree: input.processedData.data.feedBackDataToIvoree || {},
        turn: {},
        round: {},
        over: {}
    };

    let data = {
        isGameOver: false,
        isCurrentPlayer: false,
        // roundName:
        turnData: data2
    }

    input.processedData.data.leaveResponse = data;

    resolve(input);
});

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

async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => { console.log(e) });
    if (!modTable) {
        let errorData = { success: false, info: "table couldnt be updated after move logic" };
        return errorData;
    }
    return { success: true };
}

function sendLeaveAndTurnBroadcast(input: LeavePayload) {
    setTimeout(() => {
        sendTurnFlowBroadcasts(input.room, input.processedData.data.leaveResponse, input.tableId, input.processedData.table);
    }, 50)
}
//#endregion