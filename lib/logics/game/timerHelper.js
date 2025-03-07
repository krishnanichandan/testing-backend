"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearExistingTimers = exports.startTurnTimer = void 0;
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const gameConstants_1 = require("./gameConstants");
const moveHelper_1 = require("./moveHelper");
const AutoMovesHelper_1 = require("./AutoMovesHelper");
const Queries_1 = require("../../db/Queries");
function startTurnTimer(data) {
    return __awaiter(this, void 0, void 0, function* () {
        // return;//if testing and want to disable auto move
        console.log("startTurnTimer--");
        let arr = [clearTimers, startTimer];
        let pipeline = (new j_stillery_1.Pipeline());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });
        let catchedError = null;
        let table = data.table;
        let initialData = {
            timeBankFinished: false,
            isTimeBankUsed: false,
            turnTime: table.info.turnTime,
            bettingTime: data.bettingTime || false,
            isTurnTime: data.isTurnTime || false,
            insuranceTime: data.insuranceTime || false,
            player: table.currentInfo.players[table.currentInfo.currentMoveIndex]
        };
        data.initialData = initialData;
        let result = yield pipeline.run(data).catch((e) => {
            // logger.info("startTurnTimer--",e.errorData)
            console.log("EXCEPTION HERE", e.errorData);
            catchedError = e;
        });
        if (!!result) {
        }
        else {
        }
    });
}
exports.startTurnTimer = startTurnTimer;
let clearTimers = new j_stillery_1.Task((input, resolve, reject) => {
    clearExistingTimers(input.room);
    resolve(input);
});
function clearExistingTimers(room) {
    // logger.info("clearExistingTimers--called",room)
    if (!!room.timerRefs.turnTimeReference) {
        // clearTimeout(room.timerRefs.turnTimeReference);
        room.timerRefs.turnTimeReference.clear();
        room.timerRefs.turnTimeReference = null;
    }
    else {
        // 'TURN TIMER NOT EXISTS, while restarting auto turn timer !!');
    }
    if (!!room.timerRefs.performAutoStand) {
        // clearTimeout(room.timerRefs.performAutoSitout);
        console.log("cleared stand Time");
        room.timerRefs.performAutoStand.clear();
        room.timerRefs.performAutoStand = null;
    }
    if (!!room.timerRefs.insuranceTimeRefernce) {
        console.log("cleared insurance Time");
        room.timerRefs.insuranceTimeRefernce.clear();
        room.timerRefs.insuranceTimeRefernce = null;
    }
    if (!!room.timerRefs.bettingTimeRefernce) {
        console.log("cleared betting Time");
        room.timerRefs.bettingTimeRefernce.clear();
        room.timerRefs.bettingTimeRefernce = null;
    }
}
exports.clearExistingTimers = clearExistingTimers;
let startTimer = new j_stillery_1.Task((input, resolve, reject) => {
    // logger.info("startTimer--called",input)
    console.log("state->", input.table.currentInfo.state);
    if (input.insuranceTime) {
        console.log("Insurance Time Start");
        // let currentInsuranceTime = input.table.info.turnTime || 15;
        let currentInsuranceTime = 10;
        (0, Queries_1.updateTimeInTable)(input.table.id, currentInsuranceTime); //updating starting of time in table to calculate the time while reconnection
        input.room.timerRefs.insuranceTimeRefernce = input.room.clock.setTimeout(() => {
            //set disconnected and resolve
            console.log("insurance time over");
            performNormalInsuranceTableAction(input);
        }, currentInsuranceTime * 1000);
    }
    if (input.bettingTime) {
        // let currentBettingTime = input.table.info.turnTime || 15;
        let currentBettingTime = 8.3;
        console.log("Betting Time Start");
        (0, Queries_1.updateTimeInTable)(input.table.id, currentBettingTime);
        input.room.timerRefs.bettingTimeRefernce = input.room.clock.setTimeout(() => {
            //set disconnected and resolve
            console.log("bettingTime Over");
            performBettingAutoMove(input);
        }, currentBettingTime * 1000);
    }
    else if (input.isTurnTime) {
        console.log("stand Time Start");
        // let currentTurnTime = input.table.info.turnTime || 15;
        let currentTurnTime = 10.3;
        // currentTurnTime = 7;
        (0, Queries_1.updateTimeInTable)(input.table.id, currentTurnTime);
        input.room.timerRefs.performAutoStand = input.room.clock.setTimeout(() => {
            //set disconnected and resolve
            console.log("auto stand over");
            performNormalTableAction(input);
        }, currentTurnTime * 1000);
    }
    resolve(input);
});
function performNormalTableAction(input) {
    //only run when timer lapsed.
    //fetch current player state
    // if disconnected move then extra turn time then timer bank(only if in playing ie reconnected) then simple move and sitout
    // if connected then extra turn time then timer bank then simple move and sitout //todos extra timer right now only doing simple move
    performAutoStand(input);
}
// perform auto move stand
function performAutoStand(input) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("player Auto stand is Called");
        let player = input.initialData.player;
        // let moves = player.moves;
        //need to include payed Position also
        let movePayload = {
            amount: 0,
            action: gameConstants_1.PlayerMove.Stand,
            tableId: input.table.id,
            actionPayload: {
                playedPosition: input.table.currentInfo.currentPlayingPosition || 'right'
            },
            playerId: player.playerId,
            room: input.room
        };
        let res = yield (0, moveHelper_1.processMove)(movePayload);
    });
}
function performNormalInsuranceTableAction(input) {
    //only run when timer lapsed.
    //fetch current player state
    // if disconnected move then extra turn time then timer bank(only if in playing ie reconnected) then simple move and sitout
    // if connected then extra turn time then timer bank then simple move and sitout //todos extra timer right now only doing simple move
    performInsuranceActionOnTable(input);
}
function performInsuranceActionOnTable(input) {
    return __awaiter(this, void 0, void 0, function* () {
        //perform gameOver if insurance Placed
        // perform start turn if not the insurance placed by any player
        let insurancePayload = {
            tableId: input.table.id,
            room: input.room
        };
        (0, AutoMovesHelper_1.performInsuranceOnTable)(insurancePayload);
    });
}
function performBettingAutoMove(input) {
    let payload = {
        tableId: input.table.id,
        room: input.room
    };
    (0, AutoMovesHelper_1.performAutoBettingMove)(payload);
}
