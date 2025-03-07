import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { initial } from "underscore";
import { GameRoom } from "../../rooms/GameRoom";
import { Table } from "../../dataFormats/table";
import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { PlayerMove } from "./gameConstants";
import { MakeMovePayload, processMove } from "./moveHelper";
import { performAutoBettingMove, performInsuranceOnTable } from "./AutoMovesHelper";
import { GameState } from "./types";
import { updateTimeInTable } from "../../db/Queries";

type TimerPayload = {
    table: Table,
    insuranceTime?: boolean;
    bettingTime?: boolean;
    isTurnTime?: boolean;
    room: GameRoom,
    playerId?: string,
    errorData?: any,
    initialData?: any
}

export async function startTurnTimer(data: TimerPayload): Promise<void> {
    // return;//if testing and want to disable auto move
    console.log("startTurnTimer--")
    let arr: Task<TimerPayload>[] = [clearTimers, startTimer];
    let pipeline = (new Pipeline<TimerPayload>());
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });
    let catchedError: TimerPayload = null;

    let table: Table = data.table;
    let initialData = {
        timeBankFinished: false,
        isTimeBankUsed: false,
        turnTime: table.info.turnTime,
        bettingTime: data.bettingTime || false,
        isTurnTime: data.isTurnTime || false,
        insuranceTime: data.insuranceTime || false,
        player: table.currentInfo.players[table.currentInfo.currentMoveIndex]
    }
    data.initialData = initialData;

    let result: TimerPayload | void = await pipeline.run(data).catch((e: TimerPayload) => {
        // logger.info("startTurnTimer--",e.errorData)
        console.log("EXCEPTION HERE", e.errorData);
        catchedError = e;
    });
    if (!!result) {

    } else {

    }


}
let clearTimers = new Task<TimerPayload>((input: TimerPayload, resolve, reject) => {
    clearExistingTimers(input.room);
    resolve(input);
});

export function clearExistingTimers(room: GameRoom) {
    // logger.info("clearExistingTimers--called",room)
    if (!!room.timerRefs.turnTimeReference) {
        // clearTimeout(room.timerRefs.turnTimeReference);
        room.timerRefs.turnTimeReference.clear();
        room.timerRefs.turnTimeReference = null;
    } else {
        // 'TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
    }



    if (!!room.timerRefs.performAutoStand) {
        // clearTimeout(room.timerRefs.performAutoSitout);
        console.log("cleared stand Time")
        room.timerRefs.performAutoStand.clear();
        room.timerRefs.performAutoStand = null;
    }

    if (!!room.timerRefs.insuranceTimeRefernce) {
        console.log("cleared insurance Time")
        room.timerRefs.insuranceTimeRefernce.clear();
        room.timerRefs.insuranceTimeRefernce = null;
    }
    if (!!room.timerRefs.bettingTimeRefernce) {
        console.log("cleared betting Time")
        room.timerRefs.bettingTimeRefernce.clear();
        room.timerRefs.bettingTimeRefernce = null;
    }
}
let startTimer = new Task<TimerPayload>((input: TimerPayload, resolve, reject) => {
    // logger.info("startTimer--called",input)
    console.log("state->", input.table.currentInfo.state)
    if (input.insuranceTime) {
        console.log("Insurance Time Start")
        // let currentInsuranceTime = input.table.info.turnTime || 15;
        let currentInsuranceTime = 10;
        updateTimeInTable(input.table.id, currentInsuranceTime);//updating starting of time in table to calculate the time while reconnection
        input.room.timerRefs.insuranceTimeRefernce = input.room.clock.setTimeout(() => {
            //set disconnected and resolve
            console.log("insurance time over",);
            performNormalInsuranceTableAction(input);
        }, currentInsuranceTime * 1000);
    }

    if (input.bettingTime) {
        // let currentBettingTime = input.table.info.turnTime || 15;
        let currentBettingTime = 8.3;
        console.log("Betting Time Start")
        updateTimeInTable(input.table.id, currentBettingTime);
        input.room.timerRefs.bettingTimeRefernce = input.room.clock.setTimeout(() => {
            //set disconnected and resolve
            console.log("bettingTime Over");
            performBettingAutoMove(input);
        }, currentBettingTime * 1000);
    }
    else if (input.isTurnTime) {
        console.log("stand Time Start")
        // let currentTurnTime = input.table.info.turnTime || 15;
        let currentTurnTime = 10.3;
        // currentTurnTime = 7;
        updateTimeInTable(input.table.id, currentTurnTime);
        input.room.timerRefs.performAutoStand = input.room.clock.setTimeout(() => {
            //set disconnected and resolve
            console.log("auto stand over",);
            performNormalTableAction(input);
        }, currentTurnTime * 1000);
    }

    resolve(input);
});

function performNormalTableAction(input: TimerPayload) {
    //only run when timer lapsed.
    //fetch current player state
    // if disconnected move then extra turn time then timer bank(only if in playing ie reconnected) then simple move and sitout
    // if connected then extra turn time then timer bank then simple move and sitout //todos extra timer right now only doing simple move

    performAutoStand(input);
}

// perform auto move stand
async function performAutoStand(input: TimerPayload) {
    console.log("player Auto stand is Called")

    let player: InGamePlayer = input.initialData.player;
    // let moves = player.moves;

    //need to include payed Position also
    let movePayload = {
        amount: 0,
        action: PlayerMove.Stand,
        tableId: input.table.id,
        actionPayload: {
            playedPosition: input.table.currentInfo.currentPlayingPosition || 'right'
        },
        playerId: player.playerId,
        room: input.room
    }

    let res = await processMove(movePayload as MakeMovePayload);

}

function performNormalInsuranceTableAction(input: TimerPayload) {
    //only run when timer lapsed.
    //fetch current player state
    // if disconnected move then extra turn time then timer bank(only if in playing ie reconnected) then simple move and sitout
    // if connected then extra turn time then timer bank then simple move and sitout //todos extra timer right now only doing simple move

    performInsuranceActionOnTable(input);
}
async function performInsuranceActionOnTable(input: TimerPayload) {

    //perform gameOver if insurance Placed
    // perform start turn if not the insurance placed by any player
    let insurancePayload = {

        tableId: input.table.id,

        room: input.room
    }
    performInsuranceOnTable(insurancePayload);
}

function performBettingAutoMove(input: TimerPayload) {
    let payload = {
        tableId: input.table.id,

        room: input.room
    }
    performAutoBettingMove(payload)
}

