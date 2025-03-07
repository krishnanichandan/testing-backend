import { Room, matchMaker } from "colyseus";
import { forceUnlockTable, replaceTable, updateTableSettingsInDb } from "../../db/Queries";
import { processStartGame } from "./startGameHelper";
import { SchedulerHelper } from "./SchedulerHelper";
import { leavePlayer } from "./leaveHelper";
import { Table } from "../../dataFormats/table";
import * as LockerHelper from './LockTable/LockerHelper';

type ContinueGameSessionPayload = {
    room: Room;
    tableId: string;
    playerId: string;
    isPlayerWantsToContinueGameSession: boolean;
    processedData?:{
        table:Table;
    }
};

export async function continueGameSession(input: ContinueGameSessionPayload) {
    if (!input.tableId || !input.playerId) {
        console.log('Failed to change player Game Session Continue Or Exit', { tableId: input.tableId, playerId: input.playerId })
        return { success: false, info: "Couldn't complete the operation of Continue Game Session" }
    }

    input.processedData={
        table:null
    }

    let tableRes = await getTableDataFromDb(input);
    if (!tableRes) {
        // logger.error('Error in fetching table while standing up', { playerId: input.playerId });
        console.log("error in fetching table while Continue Bet Phase Called");
        // await forceUnlockTable(input.tableId);
        return;
    }
    let table = input.processedData.table;

    if (input.isPlayerWantsToContinueGameSession) {
        //resetting player session and starting the game again
        let player = input.processedData.table.currentInfo.players.filter((player) => player.playerId === input.playerId);
        if (player.length) {
            player[0].playerPlaySession = Date.now();
            player[0].playerPlaySessionExceeded = false;
            player[0].previouslyPopUpShowed = false;
            player[0].showContinueBetPopUp = false;
            player[0].playerDealtInLastRound = false;
        }

        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }else{
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
        }
        await replaceTable(input.processedData.table);

            SchedulerHelper.Instance.clearPlayerPlaySession(input.tableId, input.playerId);
            SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
            SchedulerHelper.Instance.clearInactivePlayerJob(input.tableId, input.playerId);
            SchedulerHelper.Instance.clearRemovePlayerJob(input.tableId, input.playerId);
        SchedulerHelper.Instance.startPlayerPlaySession(input.tableId, input.playerId, player[0].playerGame_timeOut_min);
        if (!remainingPlayer || !remainingPlayer.length) {
            setTimeout(function () {
                let data = { tableId: input.tableId, eventName: <const>"RESUME", room: input.room };
                processStartGame(data);
            }, 200);
        }
        return { success: true }
    } else {
        await forceUnlockTable(input.tableId);
        let room = matchMaker.getRoomById(input.tableId);
        let leavePayload = {
            playerId: input.playerId,
            tableId: input.tableId,
            isStandUp: false,
            isRequested: false,
            room: room
        }
        let res = await leavePlayer(leavePayload);
        return res;
    }
}

type ContinueBetPhase = {
    room: Room;
    tableId: string;
    playerId: string;
    isPlayerWantsToContinueBetPhase: boolean;
    processedData?: {
        errorData?: any;
        table: Table;
    }
};

async function getTableDataFromDb(input: any) {

    let table = await LockerHelper.getTable(input.tableId, "Leave").catch(e => { });

    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        return false;
    }
    input.processedData.table = table;
    return true;
}

export async function continueBetPhase(input: ContinueBetPhase) {
    input.processedData = {
        table: null
    }

    let tableRes = await getTableDataFromDb(input);
    if (!tableRes) {
        // logger.error('Error in fetching table while standing up', { playerId: input.playerId });
        console.log("error in fetching table while Continue Bet Phase Called");
        return;
    }
    let table = input.processedData.table;

    if (input.isPlayerWantsToContinueBetPhase) {
        let player = input.processedData.table.currentInfo.players.filter((player) => player.playerId === input.playerId);
        if (player.length) {
            player[0].playerDealtInLastRound = false;
            player[0].showContinueBetPopUp = false;
            player[0].previouslyPopUpShowed = false;
        }

        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }else{
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
        }
        await replaceTable(input.processedData.table);
        SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);

        if (!remainingPlayer || !remainingPlayer.length) {
        setTimeout(function () {
            let data = { tableId: input.tableId, eventName: <const>"RESUME",room:input.room };
            processStartGame(data);
        }, 200);}
        return { success: true }
    }else{
        let player = input.processedData.table.currentInfo.players.filter((player) => player.playerId === input.playerId);
        if (player.length) {
            player[0].playerDealtInLastRound = false;
            player[0].showContinueBetPopUp = false;
            player[0].previouslyPopUpShowed = false;
        }

        let remainingPlayer = input.processedData.table.currentInfo.players.filter((player) => player.showContinueBetPopUp);
        if (!remainingPlayer || !remainingPlayer.length) {
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = false;
        }else{
            input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining = true;
        }
        await replaceTable(input.processedData.table);

        let room = matchMaker.getRoomById(input.tableId);
        let leavePayload = {
            playerId: input.playerId,
            tableId: input.tableId,
            isStandUp: false,
            isRequested: false,
            room: room
        }
        SchedulerHelper.Instance.clearRemovePlayerBetPhasePopUpJob(input.tableId, input.playerId);
        let res = await leavePlayer(leavePayload);

        if (!remainingPlayer || !remainingPlayer.length) {
        setTimeout(function () {
            let data = { tableId: input.tableId, eventName: <const>"RESUME", room: input.room };
            processStartGame(data);
        }, 200);}
        return res;
    }


};