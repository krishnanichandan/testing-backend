"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.sendTurnFlowBroadcasts = exports.processMove = void 0;
const gameConstants_1 = require("./gameConstants");
const engine = __importStar(require("../game/engine"));
const types_1 = require("./types");
const broadcaster_1 = require("./broadcaster");
const j_stillery_1 = require("@open-sourcerers/j-stillery");
const timerHelper_1 = require("./timerHelper");
const Queries_1 = require("../../db/Queries");
const TurnHelper_1 = require("./TurnHelper");
const LockerHelper = __importStar(require("./LockTable/LockerHelper"));
const gameOverHelper_1 = require("./gameOverHelper");
const startGameHelper_1 = require("./startGameHelper");
const masterQueries_1 = require("../../db/masterQueries");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
let isProcessingMove = false;
// The 'processMove' function handles a player's move in the game.
// It processes the move through a series of steps (pipeline), updates the game state, 
// and finally broadcasts the result to the relevant clients
function processMove(data) {
    var _a, _b, _c;
    return __awaiter(this, void 0, void 0, function* () {
        let arr = [getTableDataFromDb, initData, ifMoveValid, validatePlayer, ifMoveAllowed, performPlayerMove, performDealerMove];
        // Create a pipeline to process the tasks in the 'arr' array
        let pipeline = (new j_stillery_1.Pipeline());
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
        let catchedError = null;
        // Run the pipeline, which processes each task one after another.
        // If any task fails, the error is caught and handled
        let res = yield pipeline.run(data).catch(e => { console.log("exception in process move"); catchedError = e; });
        // If the pipeline successfully completed, proceed with the next steps
        if (!!res) {
            let res = yield replaceTableToDb(data.processedData.table);
            if (res.success) {
                // If database update was successful, proceed to broadcast the game state changes
                // Optionally, you might want to clear existing timers (if used in the game)
                // clearExistingTimers(data.room as GameRoom)
                console.log("process move completed");
                sendTurnFlowBroadcasts(data.room, { isCurrentPlayer: data.processedData.data.isCurrentPlayer, turnData: { isGameOver: data.processedData.data.isGameOver, turn: data.processedData.broadCastTurnData }, gameOverBroadCasts: data.processedData.broadCastGameOverData }, data.tableId, data.processedData.table);
                return { success: true };
            }
            else {
                return res;
            }
        }
        else {
            // If the pipeline failed, handle the error accordingly
            if ((_b = (_a = catchedError.processedData) === null || _a === void 0 ? void 0 : _a.errorData) === null || _b === void 0 ? void 0 : _b.success) {
                let res = yield replaceTableToDb(data.processedData.table);
                if (res.success) {
                    console.log("replace table when game over etc");
                    return { success: true };
                }
                else {
                    // If DB update fails, return the failure result
                    return res;
                }
            }
            else {
                if (!!data.processedData.table) {
                    let id = (_c = data.processedData.table) === null || _c === void 0 ? void 0 : _c.id;
                    yield (0, Queries_1.forceUnlockTable)(id);
                }
                console.log("process move exception", catchedError);
            }
        }
    });
}
exports.processMove = processMove;
function replaceTableToDb(table) {
    return __awaiter(this, void 0, void 0, function* () {
        let modTable = yield (0, Queries_1.replaceTable)(table).catch(e => {
            console.log(e);
        });
        if (!modTable) {
            let errorData = { success: false, info: "table couldnt be updated after move logic" };
            return errorData;
        }
        return { success: true };
    });
}
let getTableDataFromDb = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    let table = yield LockerHelper.getTable(input.tableId, "MoveProcess").catch(e => { });
    if (!table) {
        input.processedData.errorData = { success: false, info: "Table not found for this id" };
        reject(input);
        return;
    }
    input.processedData.table = table;
    resolve(input);
}));
let initData = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    //if Dealer Move then Skipping this
    if (input.isDealerMove) {
        resolve(input);
    }
    else {
        let table = input.processedData.table;
        input.processedData.data.index = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId && player.state === types_1.PlayerState.Playing);
        // Check if player is in Disconnected state
        // In case auto turn for disconnected players
        if (input.processedData.data.index < 0) {
            input.processedData.data.index = table.currentInfo.players.findIndex((player) => player.playerId === input.playerId && player.state === types_1.PlayerState.Disconnected);
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
        input.processedData.data.isGameOver = (table.currentInfo.state === types_1.GameState.Over);
        input.processedData.data.chips = table.currentInfo.players[input.processedData.data.index].chips;
        input.processedData.data.amount = Math.trunc((_a = input.actionPayload) === null || _a === void 0 ? void 0 : _a.bet) || 0;
        input.processedData.data.originAmount = Math.trunc((_b = input.actionPayload) === null || _b === void 0 ? void 0 : _b.bet) || 0;
        input.processedData.data.considerAmount = ((_c = input === null || input === void 0 ? void 0 : input.actionPayload) === null || _c === void 0 ? void 0 : _c.bet) || 0;
        input.processedData.data.isCurrentPlayer = true;
        input.processedData.data.playerId = input.playerId;
        resolve(input);
    }
}));
// This task is responsible for validating if the player's move is allowed.
// It checks if the action the player is trying to perform is a valid move, based on the game rules.
let ifMoveValid = new j_stillery_1.Task((input, resolve, reject) => {
    // Check if the current move is not a dealer's move
    if (!input.isDealerMove) {
        if (Object.values(gameConstants_1.PlayerMove).includes(input.action)) {
            resolve(input);
        }
        else {
            // If the action is not valid, set an error in the processed data and reject the task
            let ed = ({ success: false, tableId: (input.tableId || ""), info: input.action + " is not a valid move" });
            // Add the error data to the processedData object for later use
            input.processedData.errorData = ed;
            reject(input);
        }
    }
    else {
        // If it's the dealer's move, no validation is needed, so simply resolve the input
        resolve(input);
    }
});
//check if player who sent request has current move index set. ie is valid to make a move. and current Hand Set
let validatePlayer = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e;
    if (!input.isDealerMove) {
        if (input.processedData.data.index >= 0) {
            let table = input.processedData.table;
            let data = input.processedData.data;
            if (table.currentInfo.currentMoveIndex != -1 && ((_d = table.currentInfo.players[data.index]) === null || _d === void 0 ? void 0 : _d.seatIndex) === ((_e = table.currentInfo.players[table.currentInfo.currentMoveIndex]) === null || _e === void 0 ? void 0 : _e.seatIndex)) {
                resolve(input);
            }
            else {
                input.processedData.errorData = { success: false, info: "You are not a valid player to take action!" };
                reject(input);
            }
        }
        else {
            input.processedData.errorData = { success: false, info: "You are not seated on the table. Cant make a move" };
            reject(input);
        }
    }
    else {
        resolve(input);
    }
}));
// ###  Validate if current move is allowed for this player 
let ifMoveAllowed = new j_stillery_1.Task((input, resolve, reject) => {
    if (!input.isDealerMove) {
        let table = input.processedData.table;
        let player = table.currentInfo.players[table.currentInfo.currentMoveIndex];
        const playedPosition = input.actionPayload.playedPosition;
        let handInfoOfPlayedPosition = (player.handInfo[playedPosition]);
        let availableActions = handInfoOfPlayedPosition.availableActions;
        let action = input.action.toLocaleLowerCase();
        if (!availableActions[action]) {
            let ed = ({ success: false, tableId: (input.tableId || ""), info: `${input.action} is not allowed here.` });
            input.processedData.errorData = ed;
            reject(input);
        }
        else {
            (0, timerHelper_1.clearExistingTimers)(input.room);
            resolve(input);
        }
    }
    else {
        resolve(input);
    }
});
//perform player Different Moves
let performPlayerMove = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    if (!input.isDealerMove) {
        let response = {};
        // Switch on the player's action and call the respective function to handle it.
        switch (input.action) {
            case gameConstants_1.PlayerMove.Hit: {
                response = yield playerHit(input);
                break;
            }
            case gameConstants_1.PlayerMove.Stand: {
                response = yield playerStand(input);
                break;
            }
            case gameConstants_1.PlayerMove.Split: {
                response = playerSplit(input);
                break;
            }
            case gameConstants_1.PlayerMove.Double: {
                response = yield playerDouble(input);
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
        };
        input.processedData.data.isGameOver = response.isGameOver || false;
        resolve(input);
    }
    else {
        resolve(input);
    }
}));
// This task processes the dealer's move. It ensures that the dealer performs its move only if it's their turn,
// and updates the game state accordingly. It also handles asynchronous operations involved in processing the dealer's move.
let performDealerMove = new j_stillery_1.Task((input, resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
    if (input.isDealerMove) {
        input.processedData.data.isCurrentPlayer = true;
        let dealerMoveResponse = yield handleDealerMove(input);
        if (dealerMoveResponse !== undefined) {
            resolve(input);
        }
    }
    resolve(input);
}));
function handleDealerMove(input) {
    return __awaiter(this, void 0, void 0, function* () {
        const table = input.processedData.table;
        const dealer = table.currentInfo.dealer;
        const deck = table.currentInfo.deck;
        //insurance case can be removed From here
        if (!dealer.isHoldCardOpened || input.action === 'holdCardOpen') {
            const response = yield handleHoldCardOpening(input, table, dealer);
            return response;
        }
        else if (input.action === gameConstants_1.PlayerMove.Hit) {
            const response = yield dealerHit(input, table, dealer, deck);
            return response;
        }
        else {
            const response = yield dealerStand(input, table, dealer);
            return response;
        }
    });
}
function handleHoldCardOpening(input, table, dealer) {
    return __awaiter(this, void 0, void 0, function* () {
        const holdCard = dealer.holdCard;
        dealer.hand = dealer.hand.concat(holdCard);
        const dealerPoints = engine.calculate(dealer.hand);
        dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
        const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
        dealer.isBusted = dealerHigherValidValue > 21;
        dealer.isVisible = true;
        dealer.isHoldCardOpened = true;
        dealer.totalPoints = dealerPoints;
        let resp = {};
        let currentMoveData = {
            isDealerMove: true,
            action: "holdCardOpen",
            dealerPoints,
            handInfo: dealer.hand,
            hasBlackjack: dealer.hasBlackjack,
            isBusted: dealer.isBusted,
            handValue: dealerPoints
        };
        if (dealer.isBusted || dealer.hasBlackjack || dealerHigherValidValue >= 21) { //game Over Case
            table.currentInfo.state = types_1.GameState.Over;
            let payload = {
                processedData: {
                    data: {},
                    table: table,
                }
            };
            //check this again
            const response = yield (0, gameOverHelper_1.processGameOver)(payload); //add more code
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
            };
            input.processedData.broadCastGameOverData = resp.broadcastGameOverData;
            return resp;
        }
        else if (dealerPoints.hi < 17 || (dealerPoints.hi === 17 && (dealerPoints.hi != dealerPoints.lo))) {
            let turnData = {
                isDealerMove: true,
                seatIndex: -1, //in case of Dealer it will be -1 always
                player: null, //in case of dealer it will be null
                dealer: table.currentInfo.dealer,
                currentPlayingPosition: 'right',
                nextDecidedActionForDealer: "Hit"
            };
            resp = Object.assign(Object.assign({}, resp), { table,
                currentMoveData,
                turnData });
            input.processedData.table = table;
            input.processedData.data.isGameOver = false;
            input.processedData.broadCastTurnData = {
                isDealerMove: input.isDealerMove,
                currentMoveData: resp.currentMoveData,
                nextTurnData: resp.turnData
            };
            return resp;
        }
        else {
            let turnData = {
                isDealerMove: input.isDealerMove,
                seatIndex: -1, //in case of Dealer it will be -1 always
                player: null, //in case of dealer it will be null
                dealer: table.currentInfo.dealer,
                currentPlayingPosition: 'right',
                nextDecidedActionForDealer: "Stand"
            };
            resp = Object.assign(Object.assign({}, resp), { table,
                currentMoveData,
                turnData });
            input.processedData.table = table;
            input.processedData.data.isGameOver = false;
            input.processedData.broadCastTurnData = {
                isDealerMove: input.isDealerMove,
                currentMoveData: resp.currentMoveData,
                nextTurnData: resp.turnData
            };
            return resp;
        }
    });
}
function dealerHit(input, table, dealer, deck) {
    return __awaiter(this, void 0, void 0, function* () {
        const card = popCard(deck, 1);
        dealer.hand = [...dealer.hand, card[0]];
        const dealerPoints = engine.calculate(dealer.hand);
        dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
        const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
        dealer.isBusted = dealerHigherValidValue > 21;
        dealer.totalPoints = dealerPoints;
        let resp = {};
        let currentMoveData = {
            isDealerMove: true,
            action: "Hit",
            popCard: card,
            handValue: dealerPoints,
            handInfo: dealer.hand,
            hasBlackjack: dealer.hasBlackjack,
            isBusted: dealer.isBusted
        };
        if (dealer.isBusted || dealer.hasBlackjack || (dealerHigherValidValue >= 21)) {
            table.currentInfo.state = types_1.GameState.Over;
            let payload = {
                processedData: {
                    data: {},
                    table: table,
                }
            };
            //check this again
            const response = yield (0, gameOverHelper_1.processGameOver)(payload); //add more code
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
            };
            input.processedData.broadCastGameOverData = resp.broadcastGameOverData;
            return resp;
        }
        else if (dealerPoints.hi < 17 || (dealerPoints.hi === 17 && (dealerPoints.hi != dealerPoints.lo))) {
            let turnData = {
                isDealerMove: input.isDealerMove,
                seatIndex: -1, //in case of Dealer it will be -1 always
                player: null, //in case of dealer it will be null
                dealer: table.currentInfo.dealer,
                currentPlayingPosition: 'right',
                nextDecidedActionForDealer: "Hit"
            };
            resp = Object.assign(Object.assign({}, resp), { table,
                currentMoveData,
                turnData });
            input.processedData.table = table;
            input.processedData.data.isGameOver = false;
            input.processedData.broadCastTurnData = {
                isDealerMove: input.isDealerMove,
                currentMoveData: resp.currentMoveData,
                nextTurnData: resp.turnData
            };
            return resp;
        }
        else {
            let turnData = {
                isDealerMove: input.isDealerMove,
                seatIndex: -1, //in case of Dealer it will be -1 always
                player: null, //in case of dealer it will be null
                dealer: table.currentInfo.dealer,
                currentPlayingPosition: 'right',
                nextDecidedActionForDealer: "Stand"
            };
            resp = Object.assign(Object.assign({}, resp), { table,
                currentMoveData,
                turnData });
            input.processedData.table = table;
            input.processedData.data.isGameOver = false;
            input.processedData.broadCastTurnData = {
                isDealerMove: input.isDealerMove,
                currentMoveData: resp.currentMoveData,
                nextTurnData: resp.turnData
            };
            return resp;
        }
    });
}
function dealerStand(input, table, dealer) {
    return __awaiter(this, void 0, void 0, function* () {
        const dealerPoints = engine.calculate(dealer.hand);
        dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
        const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
        dealer.isBusted = dealerHigherValidValue > 21;
        dealer.totalPoints = dealerPoints;
        let resp = {};
        table.currentInfo.state = types_1.GameState.Over;
        let payload = {
            processedData: {
                data: {},
                table: table,
            }
        };
        //check this again
        const response = yield (0, gameOverHelper_1.processGameOver)(payload); //add more code
        if (response.success) {
            input.processedData.data.isGameOver = true;
            resp.isGameOver = true;
            input.processedData.broadCastGameOverData = response.data.gameOverResponse;
            resp.broadCastGameOverData = response.data.gameOverResponse;
        }
        let currentMoveData = {
            isDealerMove: true,
            action: "Stand",
            handValue: dealerPoints,
            handInfo: dealer.hand,
            hasBlackjack: dealer.hasBlackjack,
            isBusted: dealer.isBusted
        };
        resp = Object.assign(Object.assign({}, resp), { table,
            currentMoveData, nextTurnData: {} });
        input.processedData.table = table;
        input.processedData.broadCastTurnData = {
            isDealerMove: false,
            currentMoveData: resp.currentMoveData,
            nextTurnData: {},
        };
        return resp;
    });
}
function playerHit(input) {
    return __awaiter(this, void 0, void 0, function* () {
        // Initialize response object
        let resp = {};
        // Extract necessary data from input
        let table = input.processedData.table;
        let player = table.currentInfo.players[input.processedData.data.index];
        const playedPosition = input.actionPayload.playedPosition;
        let handInfo = player.handInfo;
        const dealer = table.currentInfo.dealer;
        let playerHistory = player.history;
        let deck = table.currentInfo.deck;
        // Prepare data for current move
        let currentMoveData = {
            playerId: player.playerId,
            playerName: player.playerName,
            chips: player.chips,
            action: input.action,
            playedPosition,
            seatIndex: player.seatIndex
        };
        //pop card first
        const card = popCard(deck, 1);
        // Determine if the player has split previously
        const hasSplit = playerHistory.some(x => x.type === gameConstants_1.PlayerMove.Split);
        let playerCards = [];
        let left = {};
        let right = {};
        const action = {
            type: input.action,
            playedPosition: playedPosition
        };
        //in case of split player has two hand left and right
        // Calculate new hand information after hitting
        if (playedPosition === 'left') {
            playerCards = handInfo.left.cards.concat(card);
            left = engine.getHandInfoAfterHit(playerCards, dealer.hand, handInfo.left.initialBet, hasSplit);
            right = Object.assign({}, handInfo.right);
            action.cards = playerCards;
            action.handValue = left.handValue;
            left.initialBet = handInfo.left.initialBet;
            action.amount = left.initialBet;
        }
        else {
            playerCards = handInfo.right.cards.concat(card);
            right = engine.getHandInfoAfterHit(playerCards, dealer.hand, handInfo.right.initialBet, hasSplit);
            left = Object.assign({}, handInfo.left);
            right.initialBet = handInfo.right.initialBet;
            action.cards = playerCards;
            action.handValue = right.handValue;
            action.amount = right.initialBet;
        }
        if (hasSplit) {
            //no moresplit if already occured
            left.availableActions.split = false;
            right.availableActions.split = false;
        }
        else {
            //include other edge case
        }
        const objCards = {};
        objCards[playedPosition] = playerCards;
        const historyItem = appendEpoch(Object.assign(Object.assign({}, action), objCards));
        handInfo.left = left;
        handInfo.right = right;
        currentMoveData = Object.assign(Object.assign({}, currentMoveData), { handInfo, popCard: card });
        player.handInfo = handInfo;
        player.history.push(historyItem);
        table.currentInfo.players[input.processedData.data.index] = player;
        const findTurnResponse = (0, TurnHelper_1.findTurnForPlayers)(table, playedPosition, false);
        console.log('findTurnResponse inside playerHit :: ', table);
        resp.table = table;
        resp.currentMoveData = currentMoveData;
        table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
        const playerDataTosend = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
        let dataToSend = {};
        if (Object.keys(playerDataTosend).length) {
            dataToSend = {
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
                sideBet: playerDataTosend.sideBet,
                handInfo: playerDataTosend.handInfo,
                hasBlackJack: playerDataTosend.hasBlackJack,
                hasPlacedInsurance: playerDataTosend.hasPlacedInsurance,
            };
        }
        let turnData = {
            isDealerMove: findTurnResponse.isDealerMove,
            seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex, //in case of Dealer it will be 0 always
            player: findTurnResponse.isDealerMove ? null : dataToSend, //in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        };
        resp.turnData = turnData;
        resp.isGameOver = false;
        if (findTurnResponse.isDealerMove) {
            // possible case of gameOver in case of all busted
            const gameOverResponse = checkAllHands(table);
            if (gameOverResponse) {
                //game Over Occur changing table State
                input.processedData.table.currentInfo.state = types_1.GameState.Over;
                let payload = {
                    processedData: {
                        data: {},
                        table: input.processedData.table,
                    }
                };
                const response = yield (0, gameOverHelper_1.processGameOver)(payload); //add more code
                if (response.success) {
                    resp.isGameOver = true;
                    resp.broadCastGameOverData = response.data.gameOverResponse;
                    input.processedData.broadCastGameOverData = response.data.gameOverResponse;
                    resp.turnData = {};
                }
            }
            else {
                resp.turnData.nextDecidedActionForDealer = findTurnResponse.isDealerMove ? 'holdCardOpen' : '';
            }
        }
        input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
        return resp;
    });
}
// Checks if all players in the game have busted hands
function checkAllHands(table) {
    // Iterate through each player in the current game.
    for (const player of table.currentInfo.players) {
        if (player.state === types_1.PlayerState.Playing || (player.state === types_1.PlayerState.Disconnected && player.active === true)) {
            const handInfo = player.handInfo;
            const hasSplit = player.history.some((x) => x.type === gameConstants_1.PlayerMove.Split);
            if (hasSplit) {
                const leftBusted = handInfo.left.hasBusted;
                const rightBusted = handInfo.right.hasBusted;
                // If either the left or right hand is not busted, return false.
                // This means not all of the player's hands are busted.
                if (!leftBusted || !rightBusted) {
                    return false; // At least one player has a hand that is not busted
                }
            }
            else {
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
function playerStand(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let resp = {};
        let table = input.processedData.table;
        let player = table.currentInfo.players[input.processedData.data.index];
        const playedPosition = input.actionPayload.playedPosition;
        let handInfo = player.handInfo;
        const dealer = table.currentInfo.dealer;
        let playerHistory = player.history;
        let deck = table.currentInfo.deck;
        let playerCards = [];
        let left = {};
        let right = {};
        const action = {
            type: input.action,
            playedPosition: playedPosition
        };
        let currentMoveData = {
            playerId: player.playerId,
            playerName: player.playerName,
            chips: player.chips,
            action: input.action,
            playedPosition,
            seatIndex: player.seatIndex
        };
        if (playedPosition === 'left') {
            left = engine.getHandInfoAfterStand(handInfo.left);
            right = Object.assign({}, handInfo.right);
            playerCards = left.cards;
            left.initialBet = handInfo.left.initialBet;
            action.card = left.cards;
            action.handValue = left.handValue;
            action.amount = left.initialBet;
            // no more move on this position
        }
        else {
            left = Object.assign({}, handInfo.left);
            right = engine.getHandInfoAfterStand(handInfo.right);
            playerCards = right.cards;
            right.initialBet = handInfo.right.initialBet;
            action.cards = right.cards;
            action.handValue = right.handValue;
            action.amount = right.initialBet;
        }
        //validation for available actions
        //to Do
        const objCards = {};
        objCards[playedPosition] = playerCards;
        const historyItem = appendEpoch(Object.assign(Object.assign({}, action), objCards));
        currentMoveData = Object.assign(Object.assign({}, currentMoveData), { handInfo, popCard: {} });
        handInfo.left = left;
        handInfo.right = right;
        player.handInfo = handInfo;
        player.history.push(historyItem);
        table.currentInfo.players[input.processedData.data.index] = player;
        const findTurnResponse = (0, TurnHelper_1.findTurnForPlayers)(table, playedPosition, false);
        console.log('findTurnResponse inside playerStand :: ', table);
        resp.table = table;
        resp.currentMoveData = currentMoveData;
        table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
        const playerDataTosend = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
        let dataToSend = {};
        if (Object.keys(playerDataTosend).length) {
            dataToSend = {
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
                sideBet: playerDataTosend.sideBet,
                handInfo: playerDataTosend.handInfo,
                hasBlackJack: playerDataTosend.hasBlackJack,
                hasPlacedInsurance: playerDataTosend.hasPlacedInsurance,
            };
        }
        let turnData = {
            isDealerMove: findTurnResponse.isDealerMove,
            seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex, //in case of Dealer it will be 0 always
            player: findTurnResponse.isDealerMove ? null : dataToSend, //in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        };
        resp.turnData = turnData;
        if (findTurnResponse.isDealerMove) {
            resp.turnData.nextDecidedActionForDealer = 'holdCardOpen';
        }
        resp.isGameOver = false;
        input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
        return resp;
    });
}
function playerDouble(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let resp = {};
        let table = input.processedData.table;
        let player = table.currentInfo.players[input.processedData.data.index];
        const playedPosition = input.actionPayload.playedPosition;
        let handInfo = player.handInfo;
        const dealer = table.currentInfo.dealer;
        let playerHistory = player.history;
        let deck = table.currentInfo.deck;
        let stage = '';
        const card = popCard(deck, 1);
        player.chips = player.chips - player.initialBet;
        let playerCards = [];
        let left = {};
        let right = {};
        const hasSplit = playerHistory.some(x => x.type === gameConstants_1.PlayerMove.Split);
        const action = {
            type: input.action,
            playedPosition: playedPosition,
            card: [],
            amount: 0,
            handValue: {
                hi: 0,
                lo: 0
            }
        };
        let currentMoveData = {
            playerId: player.playerId,
            playerName: player.playerName,
            chips: player.chips,
            action: input.action,
            playedPosition,
            seatIndex: player.seatIndex
        };
        if (playedPosition === 'left') {
            right = Object.assign({}, handInfo.right);
            playerCards = handInfo.left.cards.concat(card);
            left = engine.getHandInfoAfterDouble(playerCards, dealer.hand, player.initialBet, hasSplit);
            left.initialBet = handInfo.left.initialBet * 2;
            action.card = playerCards;
            action.handValue = left.handValue;
            action.amount = left.initialBet;
        }
        else {
            playerCards = handInfo.right.cards.concat(card);
            left = Object.assign({}, handInfo.left);
            right = engine.getHandInfoAfterDouble(playerCards, dealer.hand, player.initialBet, hasSplit);
            action.card = playerCards;
            right.initialBet = handInfo.right.initialBet * 2;
            action.handValue = right.handValue;
            action.amount = right.initialBet;
        }
        handInfo.left = left;
        handInfo.right = right;
        player.handInfo = handInfo;
        const objCards = {};
        objCards[playedPosition] = playerCards;
        const historyItem = appendEpoch(Object.assign(Object.assign(Object.assign({}, action), { payload: { bet: player.initialBet } }), objCards));
        currentMoveData = Object.assign(Object.assign({}, currentMoveData), { handInfo, popCard: card });
        player.history.push(historyItem);
        player.totalBetOnTable += player.initialBet;
        table.currentInfo.players[input.processedData.data.index] = player;
        const findTurnResponse = (0, TurnHelper_1.findTurnForPlayers)(table, playedPosition, false);
        console.log('findTurnResponse inside playerDouble :: ', table);
        resp.table = table;
        resp.currentMoveData = currentMoveData;
        table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
        const playerDataTosend = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
        let dataToSend = {};
        if (Object.keys(playerDataTosend).length) {
            dataToSend = {
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
                sideBet: playerDataTosend.sideBet,
                handInfo: playerDataTosend.handInfo,
                hasBlackJack: playerDataTosend.hasBlackJack,
                hasPlacedInsurance: playerDataTosend.hasPlacedInsurance,
            };
        }
        let turnData = {
            isDealerMove: findTurnResponse.isDealerMove,
            seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex, //in case of Dealer it will be 0 always
            player: findTurnResponse.isDealerMove ? null : dataToSend, //in case of dealer it will be null
            dealer: table.currentInfo.dealer,
            currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
        };
        resp.turnData = turnData;
        resp.isGameOver = false;
        if (findTurnResponse.isDealerMove) {
            // possible case of gameOver in case of all busted
            const gameOverResponse = checkAllHands(table);
            if (gameOverResponse) {
                input.processedData.table.currentInfo.state = types_1.GameState.Over;
                let payload = {
                    processedData: {
                        data: {},
                        table: input.processedData.table,
                    }
                };
                const response = yield (0, gameOverHelper_1.processGameOver)(payload); //add more code
                if (response.success) {
                    resp.isGameOver = true;
                    input.processedData.data.isGameOver = true;
                    input.processedData.broadCastGameOverData = response.data.gameOverResponse;
                    resp.broadCastGameOverData = response.data.gameOverResponse;
                }
            }
            else {
                resp.turnData.nextDecidedActionForDealer = findTurnResponse.isDealerMove ? 'holdCardOpen' : '';
            }
        }
        input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
        return resp;
    });
}
function playerSplit(input) {
    var _a;
    let resp = {};
    let table = input.processedData.table;
    let player = table.currentInfo.players[input.processedData.data.index];
    const playedPosition = ((_a = input.actionPayload) === null || _a === void 0 ? void 0 : _a.playedPosition) || null;
    let handInfo = player.handInfo;
    const dealer = table.currentInfo.dealer;
    let playerHistory = player.history;
    let deck = table.currentInfo.deck;
    const playerCardsLeftPosition = [handInfo.right.cards[0]];
    const playerCardsRightPosition = [handInfo.right.cards[1]];
    const action = {
        type: input.action,
        playedPosition: playedPosition
    };
    let currentMoveData = {
        playerId: player.playerId,
        playerName: player.playerName,
        chips: player.chips,
        action: input.action,
        playedPosition,
        seatIndex: player.seatIndex
    };
    let left = engine.getHandInfoAfterSplit(playerCardsLeftPosition, dealer.hand, player.initialBet);
    left.initialBet = player.initialBet;
    let right = engine.getHandInfoAfterSplit(playerCardsRightPosition, dealer.hand, player.initialBet);
    right.initialBet = player.initialBet;
    const historyItem = appendEpoch(Object.assign(Object.assign({}, action), { payload: { bet: player.initialBet }, left: playerCardsLeftPosition, right: playerCardsRightPosition }));
    player.history.push(historyItem);
    //deduct chips and it's broadcast
    player.chips = player.chips - player.initialBet;
    player.initialBet = player.initialBet * 2;
    player.totalBetOnTable += player.initialBet;
    handInfo.left = left;
    handInfo.right = right;
    currentMoveData = Object.assign(Object.assign({}, currentMoveData), { handInfo });
    table.currentInfo.players[input.processedData.data.index] = player;
    const findTurnResponse = (0, TurnHelper_1.findTurnForPlayers)(table, playedPosition, false);
    console.log('findTurnResponse inside playerSplit :: ', table);
    resp.table = table;
    resp.currentMoveData = currentMoveData;
    table.currentInfo.currentMoveIndex = findTurnResponse.currentMoveIndex;
    const playerDataTosend = findTurnResponse.isDealerMove ? {} : table.currentInfo.players[findTurnResponse.currentMoveIndex];
    let dataToSend = {};
    if (Object.keys(playerDataTosend).length) {
        dataToSend = {
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
            sideBet: playerDataTosend.sideBet,
            handInfo: playerDataTosend.handInfo,
            hasBlackJack: playerDataTosend.hasBlackJack,
            hasPlacedInsurance: playerDataTosend.hasPlacedInsurance,
        };
    }
    let turnData = {
        isDealerMove: findTurnResponse.isDealerMove,
        seatIndex: findTurnResponse.isDealerMove ? -1 : table.currentInfo.players[findTurnResponse.currentMoveIndex].seatIndex, //in case of Dealer it will be 0 always
        player: findTurnResponse.isDealerMove ? null : dataToSend, //in case of dealer it will be null
        dealer: table.currentInfo.dealer,
        currentPlayingPosition: findTurnResponse.isDealerMove ? 'right' : findTurnResponse.currentPlayingPosition,
    };
    resp.turnData = turnData;
    resp.isGameOver = false;
    input.processedData.table.currentInfo.currentPlayingPosition = turnData.currentPlayingPosition;
    return resp;
}
function popCard(deck, count) {
    let cards = deck.slice(0, count);
    deck.splice(0, count);
    return cards;
}
const appendEpoch = (obj) => {
    const { payload = { bet: 0 } } = obj;
    return Object.assign({}, obj, {
        value: payload.bet || 0,
        ts: new Date().getTime()
    });
};
function sendTurnFlowBroadcasts(room, response, tableId, table) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __awaiter(this, void 0, void 0, function* () {
        if (response.isCurrentPlayer) {
            setTimeout(function () {
                console.log('onturn from turn helper 1.1');
                (0, broadcaster_1.dispatchOnTurnBroadcast)(room, response.turnData);
            }, (500));
            // Send player turn broadcast to channel level
            if (!response.turnData.isGameOver && !((_b = (_a = response.turnData) === null || _a === void 0 ? void 0 : _a.turn) === null || _b === void 0 ? void 0 : _b.nextTurnData.isDealerMove)) {
                //for now not for Dealer Move
                (0, timerHelper_1.startTurnTimer)({ room: room, table: table, isTurnTime: true });
            }
            else {
                //.error, 'Not starting channel turn timer and resetting previous ones as Game is over now!');
                if (!((_e = (_d = (_c = response.turnData) === null || _c === void 0 ? void 0 : _c.turn) === null || _d === void 0 ? void 0 : _d.nextTurnData) === null || _e === void 0 ? void 0 : _e.isDealerMove))
                    (0, timerHelper_1.clearExistingTimers)(room);
            }
        }
        if (response.isCurrentPlayer) {
            if (((_g = (_f = response.turnData) === null || _f === void 0 ? void 0 : _f.turn) === null || _g === void 0 ? void 0 : _g.nextTurnData.isDealerMove) && !response.turnData.isGameOver) {
                let movePayload = {
                    room,
                    tableId,
                    isDealerMove: true,
                    action: response.turnData.turn.nextTurnData.nextDecidedActionForDealer
                };
                setTimeout(function () {
                    console.log('process move called from move Helper');
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
            if ((_h = response.gameOverBroadCasts) === null || _h === void 0 ? void 0 : _h.dealerHoldCardDistributeBroadCast) {
                const dealer = response.gameOverBroadCasts.dealer;
                const holdCard = dealer.holdCard;
                dealer.hand = dealer.hand.concat(holdCard);
                const dealerPoints = engine.calculate(dealer.hand);
                dealer.hasBlackjack = engine.isBlackjack(dealer.hand);
                const dealerHigherValidValue = engine.getHigherValidValue(dealerPoints);
                dealer.isBusted = dealerHigherValidValue > 21;
                dealer.isVisible = true;
                dealer.isHoldCardOpened = true;
                dealer.totalPoints = dealerPoints;
                const currentMoveData = {
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
                };
                let turnData = { isGameOver: true, turn: broadCastTurnData };
                setTimeout(function () {
                    console.log('onturn from turn helper 1.2');
                    (0, broadcaster_1.dispatchOnTurnBroadcast)(room, turnData);
                }, (300));
            }
            setTimeout(function () {
                (0, broadcaster_1.dispatchGameOverBroadcast)(room, { playersResult: response.gameOverBroadCasts.playersResult, dealer: response.gameOverBroadCasts.dealer });
            }, (3000));
            // restart game if game over occurs
            setTimeout(function () {
                let payload = {
                    tableId: tableId,
                    eventName: "RESUME",
                    room: room
                };
                (0, startGameHelper_1.processStartGame)(payload);
            }, (6000));
        }
        //  If leave broadcast is prsent then handle leave additional events
        if (!!response.turnData.leaveBroadcast) {
            if (!!response.turnData.leaveBroadcast.clearTimer) {
                (0, timerHelper_1.clearExistingTimers)(room);
            }
            (0, broadcaster_1.dispatchLeaveBroadcast)(room, response.turnData.leaveBroadcast);
            if (!!response.turnData.feedBackDataToIvoree) {
                if (!!response.turnData.feedBackDataToIvoree && !!response.turnData.feedBackDataToIvoree.playerId) {
                    const feedBackDataToIvoree = response.turnData.feedBackDataToIvoree;
                    const player = yield (0, masterQueries_1.findUser)({ playerId: response.turnData.feedBackDataToIvoree.playerId });
                    const startDateTime = new Date(player.loginInfo.lastLogin);
                    const endDateTime = new Date();
                    // Calculate the difference in milliseconds
                    const timeDifferenceMs = endDateTime - startDateTime;
                    // Convert milliseconds to minutes
                    const totalPlayMinutes = Math.round(timeDifferenceMs / (1000 * 60));
                    const dataToSend = {
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
                    };
                    console.log("data to send", JSON.stringify(dataToSend));
                    const bearerToken = player.loginInfo.callback_token.substring("Bearer".length + 1);
                    const callbackUrl = player.loginInfo.callback_url + '/api/BG/player/rating';
                    console.log(callbackUrl);
                    const axiosConfig = {
                        headers: {
                            'Authorization': `Bearer ${bearerToken}`,
                            'Content-Type': 'application/json'
                        }
                    };
                }
            }
        }
    });
}
exports.sendTurnFlowBroadcasts = sendTurnFlowBroadcasts;
