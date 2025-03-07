import { Room } from "colyseus";
import { Table } from "../../dataFormats/table";
import * as engine from '../game/engine'
import { Pipeline, Task } from "@open-sourcerers/j-stillery";
import { indexOf, map, pick, pluck, where } from "underscore";
import { GameState, HandValue, PlayerState } from "./types";
import { HandInfo, InGamePlayer } from "../../dataFormats/InGamePlayer";
import { fetchTable, forceUnlockTable, replaceTable } from "../../db/Queries";
import { getPlayersByState, totalActiveBettingPlayers, totalActivePlayers } from "./TableUtils/TableHelper";
import { dispatchDistributeCardsBroadcast, dispatchGameOverBroadcast, dispatchInsuranceBroadCasts, dispatchOnTurnBroadcast, dispatchPlayerBetContinuePhaseBroadcast, dispatchPlayerPlaySessionBroadCast, dispatchPlayerStateBroadcast, dispatchStartBettingBroadCasts, dispatchStartGameBroadcast, dispatchTablePlayersBroadcast } from "./broadcaster";
import { clearExistingTimers, startTurnTimer } from "./timerHelper";
import randy from "./TableUtils/randy";
import { GameRoom } from "../../rooms/GameRoom";
import { distributeCards } from "./TableUtils/CardDistributer";
import { findTurnForPlayers } from "./TurnHelper";
import { Card } from "./Cards/Card";
import { Deck } from "./Cards/Deck";
import * as LockerHelper from './LockTable/LockerHelper';
import { GameOverPayload, processGameOver } from "./gameOverHelper";
import { SchedulerHelper } from "./SchedulerHelper";
import { json } from "express";
import { DbManager } from "../../db/DbManager";
const uuid = require('uuid');

type StartGamePayload = {
    tableId: string;
    eventName: "SIT" | "GAMEOVER" | "ADDCHIPS" | "RESUME";
    processedData?: ProcessingData;
    room?: Room
};

type ProcessingData = {
    broadcastGameOverData: any;
    gameStartEvent: any;
    errorData?: { success: boolean; tableId?: string; info: string; };
    data: {
        spectatorPlayer: any[];
        isGameOver: boolean;
        bettingPhaseStart?: boolean;
        canInsurancePlace?: boolean;
        readyPlayers?: InGamePlayer[];
        currentGameState?: GameState;
        startGame?: boolean;
        isBettingStillInProgress?: boolean;
        isBettingDoneByAllPlayers?: boolean;
        players?: any[]; //playing

        tableDetails?: any;
        distributeCardsResponse?: any;
        dataPlayers?: InGamePlayer[];
        preGameState?: string;
        startGameBroadcastData?: any;
    },
    idleStateData?: IdlePhaseData,
    bettingStateData?: {
        preGameState: string;
        gamePlayers: InGamePlayer[];
        players: InGamePlayer[];
        startGame: boolean;
        response: {
            data: {
                players: InGamePlayer[];
                state: string;
                startGame: boolean;
                success: boolean;
            }
        }
    }
    table: Table
}

type IdlePhaseData = {
    preGameState: string;
    bettingPlayers: InGamePlayer[];//players who will be in bettingState
    players: InGamePlayer[];//all players
    startGame: boolean;
    response: {
        data: {
            players: InGamePlayer[];//players who will be in bettingState
            state: string;
            startGame: boolean;
            success: boolean;
        }
    }
}

// Async function to start the game by processing the provided game data
export async function processStartGame(data: StartGamePayload): Promise<void> {

    // Define an array of functions (tasks) that will be executed in sequence in the pipeline
    let arr: Task<StartGamePayload>[] = [
        initData, checkIfGameAlreadyStart, getTableDataFromDb,
        nestedCheckGameIdleState, nestedChekGameBettingState, fireGamePlayersBroadcast,
        setOnBreakAndStartReserveTimer, checkGameStart, fireCardDistributeBroadcast,
        fireStartGameBroadcast, fireInsuranceBroadCastAndTimer, fireOnTurnBroadCast];

         // Create a new Pipeline instance and add the tasks to it
    let pipeline = (new Pipeline<StartGamePayload>());
    // Add the tasks to the pipeline
    arr.forEach((functionRef) => {
        pipeline.pipe(functionRef);
    });
    let catchedError: StartGamePayload = null;
    // Execute the pipeline and catch any exceptions
    let result: StartGamePayload | void = await pipeline.run(data).catch((e: StartGamePayload) => {
        console.log("EXCEPTION HERE in start game", e.processedData?.errorData)

        catchedError = e;
        //check on this while setting again
    });

    if (!!result) {
      
    } else {
        
        console.log(catchedError);
    }
}

let initData = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
    input.processedData = {
        broadcastGameOverData: {},
        gameStartEvent: "IDLE",
        data: {
            isGameOver: false,
            startGame: false,
            players: [],
            tableDetails: null,
            canInsurancePlace: false,
            readyPlayers: [],
            dataPlayers: [],
            spectatorPlayer:[]


        },
        table: null,
    }
    resolve(input);
});

// ### Validate if a game start event is already set on channel level
// If yes then skip start game process from current event
// If not then set start event on channel level
// If Game will not start then reset start event on channel level
//will check it again
let checkIfGameAlreadyStart = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {

    
    resolve(input);
});

let getTableDataFromDb = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
    //Fetching table:
    let table = await LockerHelper.getTable(input.tableId, "StartGameProcess").catch(e => { });
    if (!table) {
        input.processedData.errorData = { success: false, info: "Table could not be retrieved for starting game" };
        reject(input);
        return;
    }

    input.processedData.table = table;
    if (![`${GameState.Idle}`, `${GameState.Betting}`].includes(`${table.currentInfo.state}`)) {
        input.processedData.errorData = { success: false, info: "Game is already runnning" };
        await forceUnlockTable(input.tableId);
        reject(input);
    }
    resolve(input)
})

//nested game Idle State check-> if Idle then below are the things to check and to do and return directly from Here in 'if' case
//check minimumPlayers
//check enough chips to go in Bet phase
//setPlayer state as Betting and start Betting Phase
//mark Player as active
//sort them based on their seat Index
let nestedCheckGameIdleState = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
    const gameState = input.processedData.table.currentInfo.state;

    if (gameState === GameState.Idle) {

        //initializing Data
        let initData = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            input.processedData.idleStateData = {
                preGameState: (input.processedData.table.currentInfo.state),
                bettingPlayers: [],
                players: input.processedData.table.currentInfo.players,
                startGame: false,
                response: {
                    data: {
                        players: [],
                        state: input.processedData.table.currentInfo.state,
                        startGame: false,
                        success: false
                    },

                }
            };
            input.processedData.data.preGameState = input.processedData.table.currentInfo.state;
            input.processedData.data.bettingPhaseStart = false;
            resolve(input);
        });

        //reseting PlayerStates
        let resetPlayerState = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            // const players = [];
            for (let i = 0; i < input.processedData.table.currentInfo.players.length; i++) {
                let player = input.processedData.table.currentInfo.players[i];
                let dataForPlayerSession = { playerId: player.playerId, seatIndex: player.seatIndex, chips: player.chips }
                
                
                if (player.chips < input.processedData.table.info.minBuyIn) {
                        player.state = PlayerState.OutOfMoney;
                    
                }

               
                player.onGameStartBuyIn = player.chips;
            }
           
            resolve(input);
        });
// Define a Task that processes inactivity for players and updates the spectator list.
        let scheduleInactivityJobForPlayers = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
                // Extract the game table from the input payload
            let table: Table = input.processedData.table;
            table.currentInfo.players.forEach((player) => {
                SchedulerHelper.Instance.removeInactivePlayer(input.tableId, player.playerId);
            })
                // Access the "tablejoinrecord" collection in the database to get players who are spectators
            const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
            const result = await tableJoinCollection.find({ tableId: input.tableId, isSpectator: true }).toArray();
            let spectatorPlayer: any[] = [];
            result && result.forEach((player) => {
                spectatorPlayer.push(player.playerId)
            })
            
    // Add the list of spectator players to the processed data object
            input.processedData.data.spectatorPlayer = spectatorPlayer
            resolve(input)
        });

        let changePlayerStateToBetting = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            const players: { playerId: string; seatIndex: number; chips: number; state: PlayerState.Waiting; }[] = [];
            input.processedData.table.currentInfo.players.forEach((player: InGamePlayer) => {
                if (player.chips >= input.processedData.table.info.minBuyIn) {
                    if (player.state === PlayerState.Waiting || player.state === PlayerState.Playing || player.state === PlayerState.Disconnected) {
                        player.state = PlayerState.Betting;
                        player.active = true;
                        player.isWaitingPlayer = false;
                        
                    }
                } else {
                    
                    player.active = false;
                    player.isWaitingPlayer = true;
                }
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
                player.hasBlackJack = false,
                    player.hasPlacedInsurance = false,
                    player.history = [];

                    if (player.playerPlaySessionExceeded && !player.previouslyPopUpShowed) {
                        player.state = PlayerState.Waiting;
                        player.active = false;
                        player.isWaitingPlayer = true;
                        player.playerDealtInLastRound = true;
                        player.showContinueBetPopUp = false;
                        player.previouslyPopUpShowed = true;
                        players.push({ playerId: player.playerId, seatIndex: player.seatIndex, chips: player.chips,state:player.state });
                        
                    }else if(player.playerPlaySessionExceeded){
                        player.state = PlayerState.Waiting;
                        player.active = false;
                        player.isWaitingPlayer = true;
                    }
            })

            if (players.length) {
                players.forEach(player => {
                    SchedulerHelper.Instance.removePlayerIfSessionExceed(input.tableId, player.playerId);
                })
                dispatchPlayerPlaySessionBroadCast(input.room, {players:players});
            }
            resolve(input);
        });

        let askForContinueBetPhaseAndGameSessionToPlayers = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            if (input.processedData.table.currentInfo.showBetPhaseContinuePopUpRemaining) {
                const players: { playerId: string; seatIndex: number; chips: number; state: PlayerState.Waiting; }[] = [];
                input.processedData.table.currentInfo.players.forEach((player: InGamePlayer) => {
                    if (player.showContinueBetPopUp && !player.previouslyPopUpShowed) {
                        player.state = PlayerState.Waiting;
                        player.active = false;
                        player.isWaitingPlayer = true;
                        player.previouslyPopUpShowed = true;
                        players.push({ playerId: player.playerId, seatIndex: player.seatIndex, chips: player.chips, state: player.state });
                    }
                })
               
                if (players.length) {
                    players.forEach(player => {
                        SchedulerHelper.Instance.removePlayerIfBetPhasePopNotResponsd(input.tableId, player.playerId);
                    })
                    console.log("PlayerBetContinuePhaseBroadcast->", JSON.stringify(players))
                    dispatchPlayerBetContinuePhaseBroadcast(input.room, { players: players });
                    let errorData = ({ success: true, info: 'Some players Did not dealt in previous Round waiting For their continuous play response - ' });
                    input.processedData.errorData = errorData;
                    reject(input);
                }
                resolve(input)
                
            }else{
                resolve(input)
            }
        });

        

        let isGameGoingToStart = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let table: Table = input.processedData.table;
            let bettingPlayers = getPlayersByState(table, PlayerState.Betting);//table.currentInfo.players.filter(player => (player.state === PlayerState.Playing));
            // If less than 1 players then do not start game
            // Do not perform consider player logic. Return function from here
            if (bettingPlayers.length < 1) {
                input.processedData.data.bettingPhaseStart = false;
                input.processedData.idleStateData.startGame = false;
                input.processedData.idleStateData.response.data.startGame = false;
                let errorData = ({ success: true, info: 'Less players than to start betting phase - ' + 1 });
                input.processedData.errorData = errorData;
                reject(input); //need to do return else code proceeds to run below
            } else {
                input.processedData.data.bettingPhaseStart = true;
                input.processedData.idleStateData.startGame = true;
                input.processedData.idleStateData.response.data.startGame = true;
                resolve(input)
            }
            resolve(input);
        });

        // ### Sort players indexes
        // > (NOTE: Keep non-playng players at the end of players array list)
        let sortPlayerIndexes = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let table: Table = input.processedData.table;
            // Refresh player list sorted as seatIndex
            table.currentInfo.players.sort(function (a, b) { return a.seatIndex - b.seatIndex; });
            let bettingPlayers: any[] = [];
            let inactivePlayer: any[] = [];

            table.currentInfo.players.forEach((player) => {
                if (player.state !== PlayerState.Betting) {
                    inactivePlayer.push(player);
                } else {
                    bettingPlayers.push(player);
                }
            })
            table.currentInfo.players = bettingPlayers.concat(inactivePlayer);
            resolve(input);
        });


        let removeTournamentPlayers = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            resolve(input)
        });

        // If enough players to start the Betting Phase of game
        let isEnoughBettingPlayers = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let table: Table = input.processedData.table;
            let totalActivePlayersResponse: any = totalActiveBettingPlayers(input.processedData)
            input.processedData.idleStateData.bettingPlayers = JSON.parse(JSON.stringify(totalActivePlayersResponse.players))
            input.processedData.idleStateData.bettingPlayers.forEach((player) => {
                player.turnTime = 8;
            })

            if (totalActivePlayersResponse.success) {

                if (totalActivePlayersResponse.players.length >= 1 && totalActivePlayersResponse.players.length <= 3) {
                    input.processedData.data.bettingPhaseStart = true;
                    input.processedData.idleStateData.startGame = true;
                    input.processedData.idleStateData.response.data.startGame = true;
                    resolve(input);
                } else {
                    input.processedData.data.bettingPhaseStart = false;
                    input.processedData.idleStateData.startGame = false;
                    input.processedData.idleStateData.response.data.startGame = false;
                    let errorData = { success: true, tableId: table.id, info: " There are less active players to start the game!" }
                    input.processedData.errorData = errorData;
                    reject(input);
                }

            } else {
                input.processedData.data.bettingPhaseStart = false;
                input.processedData.idleStateData.startGame = false;
                input.processedData.idleStateData.response.data.startGame = false;
                let errorData = totalActivePlayersResponse
                input.processedData.errorData = errorData;
                reject(input);
            }
        });

        // Create roundId for current round
        //check do we need this
        let inserRoundId = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let table: Table = input.processedData.table;
            table.currentInfo.roundId = uuid.v4();
            table.currentInfo.gameStartTime = Number(new Date());
            table.currentInfo.roundNumber = '';
            for (var i = 0; i < 12; i++) {
                table.currentInfo.roundNumber += Math.floor(Math.random() * 10);
            }
            table.currentInfo.players.forEach((player: any) => {
                if (player.state === PlayerState.Betting) {
                    player.roundId = table.currentInfo.roundId;
                }
            })
            resolve(input);
        });


        let gamePlayersData = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            input.processedData.data.dataPlayers = JSON.parse(JSON.stringify(map(input.processedData.idleStateData.players, function (player) { return pick(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "active"); })));
            resolve(input);
        });

        let checkBettingPhaseStart = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            // console.log("checkGameStart")
            if (input.processedData.data.bettingPhaseStart) {
                resolve(input);
            } else {
                let errorData = { success: false, info: "check betting phase start found false" };
                input.processedData.errorData = errorData;
                reject(input);
                return
            }
        });

        let changeGameStateAndTableAttributes = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            if (input.processedData.data.bettingPhaseStart) {
                input.processedData.table.currentInfo.state = GameState.Betting
                input.processedData.table.currentInfo.dealer = {
                    hand: [],
                    holdCard: {} as Card,
                    isHoldCardOpened: false,
                    totalPoints: {} as HandValue,
                    isSoft17: false,
                    isBusted: false,
                    hasBlackjack: false,
                    isVisible: false,
                };

                input.processedData.table.currentInfo.players.forEach((player) => {
                   
                    player.initialBet = 0;
                    //insertingRound Id will check later do wee need it for all
                    player.roundId = input.processedData.table.currentInfo.roundId;
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
                    player.history = [];
                })
            }
            resolve(input)
        });

        let checkContinueBettingPhase = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            if (input.processedData.table.currentInfo.maxBettingCountOnTable == 0) {
                input.processedData.errorData = { success: false, info: "Game Over as no one has Bet more than 1 time continuously" }
                input.processedData.data.bettingPhaseStart = false;
                reject(input);
            }
            resolve(input);
        });

        let fireGamePlayersBroadcast = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            // logger.info("fireGamePlayersBroadcast started", input)

            // console.log(1)
            // console.log("fireGamePlayersBroadcast");

            if (!input.eventName) {
                input.processedData.errorData = { success: false, info: "missing event name at start betting phase" }
                reject(input);
                return false;
            }
            if (input.processedData.data.preGameState !== GameState.Idle) {
                console.log("some error here.investing preGameState at Idle state")
                resolve(input);//reject?
                return false;
            }
            if (input.processedData.data.bettingPhaseStart) {//or check data.startGAme
                input.room.metadata.gameStartEventSet = "IDLE";
                input.processedData.gameStartEvent = "BETTING"
                // console.error('====+++++++', params.data, params.data.dataPlayers, Object.keys(params))
                setTimeout(function () {
                    console.log("TablePlayerBroadcast-> 1", JSON.stringify({ tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers }))
                    dispatchTablePlayersBroadcast(input.room, { tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers, spectator: input.processedData.data.spectatorPlayer });
                }, (300));

                // todos// firePlayerChipsLobbyBroadcast(pomelo.app, params.channelId, params.channel.channelType, params.data.dataPlayers);
                resolve(input);
                return true;
            } else {
                input.room.metadata.gameStartEventSet = "IDLE";
                input.processedData.gameStartEvent = "IDLE"
                setTimeout(function () {
                    console.log("TablePlayerBroadcast-> 2", JSON.stringify({ tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers }))
                    dispatchTablePlayersBroadcast(input.room, { tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers, spectator: input.processedData.data.spectatorPlayer });
                }, (300));
                // todos// firePlayerChipsLobbyBroadcast(pomelo.app, params.channelId, params.channel.channelType, params.data.dataPlayers);
                resolve(input);

            }
        });
 
        function resetTableOnNoBettingStart(table: Table) {
            table.currentInfo.state = GameState.Idle;
            table.currentInfo.currentMoveIndex = -1;
            table.currentInfo._v = 0;
            table.currentInfo.maxBettingCountOnTable = 1;
            table.currentInfo.roundId = '';
            table.currentInfo.dealer = {
                hand: [],
                holdCard: {} as Card,
                isHoldCardOpened: false,
                totalPoints: {} as HandValue,
                isSoft17: false,
                isBusted: false,
                hasBlackjack: false,
                isVisible: false,
            }

            // Resetting players
            table.currentInfo.players.forEach((player) => {
                if ([PlayerState.Betting || PlayerState.Disconnected || PlayerState.Playing || PlayerState.Waiting].includes(player.state)) {
                   
                    player.state = PlayerState.Waiting;
                    player.active = false;
                    player.hasPlayedOnceOnTable = true;
                    player.isWaitingPlayer = true;
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
                    player.roundId = ''
                }
            });
        }


        let arr: Task<StartGamePayload>[] = [
            initData, resetPlayerState, scheduleInactivityJobForPlayers, changePlayerStateToBetting, askForContinueBetPhaseAndGameSessionToPlayers, isGameGoingToStart, sortPlayerIndexes, removeTournamentPlayers,
            isEnoughBettingPlayers,
            inserRoundId,// shuffleDeck,
            gamePlayersData, checkBettingPhaseStart, changeGameStateAndTableAttributes, checkContinueBettingPhase, fireGamePlayersBroadcast];
        let pipeline = (new Pipeline<StartGamePayload>());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        })
        pipeline.run(input).then(async (result: StartGamePayload) => {

            if (input.processedData.data.bettingPhaseStart) {
                //fire timer broadcast
                //start timer For all players
                input.processedData.table.currentInfo.maxBettingCountOnTable -= 1;
                let table = await replaceTable(input.processedData.table);
                console.log("after replacing table ");
                // start Betting Timer
                let bettingTimer = input.room.clock.setTimeout(function (params: any) {

                    console.log("StartBettingBroadCast->",JSON.stringify({ tableId: input.tableId, bettingPlayers: input.processedData.idleStateData.bettingPlayers }))
                    dispatchStartBettingBroadCasts(input.room, { tableId: input.tableId, bettingPlayers: input.processedData.idleStateData.bettingPlayers });
                    startTurnTimer({ room: input.room as GameRoom, table: input.processedData.table, bettingTime: true });

                }, 800, input);

                reject(input);
                return;
            } else {
                reject(input);
                return false;
            }

        }, async (input: StartGamePayload) => {

            input.processedData.data.startGame = false;
            input.processedData.data.preGameState = input.processedData.idleStateData.preGameState;
            console.log(" check Idle phase nested failed", input.processedData.errorData);

            input.processedData.table.currentInfo.state = GameState.Idle;
            input.processedData.table.currentInfo.stateInternal = GameState.Idle;

            console.log("bet phase not starting coz ", input.processedData.errorData);
            console.log("************************reseting Table as no game Start******************")
            resetTableOnNoBettingStart(input.processedData.table)
            input.processedData.data.dataPlayers = JSON.parse(JSON.stringify(map(input.processedData.table.currentInfo.players, function (player) { return pick(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "active"); })));
            setTimeout(function () {
                console.log("TablePlayerBroadCast-> 3", JSON.stringify({ tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers }))
                dispatchTablePlayersBroadcast(input.room, { tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers, spectator: input.processedData.data.spectatorPlayer });
            }, (300));
            if (!!input.processedData.table) {
                // forceUnlockTable(input.processedData.table.id);
                let table = await replaceTable(input.processedData.table)
            }
            reject(input);
            return input.processedData.errorData;
        });

    } else {
        resolve(input)
    }
});

/**
 * new Region
 */
//check Game Betting State
let nestedChekGameBettingState = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
    let table = input.processedData.table;

    if (table.currentInfo.state === GameState.Betting) {
        let initData = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
            input.processedData.bettingStateData = {
                preGameState: table.currentInfo.state,
                gamePlayers: table.currentInfo.players,
                players: table.currentInfo.players,
                startGame: false,
                response: {
                    data: {
                        players: table.currentInfo.players,
                        state: table.currentInfo.state,
                        startGame: false,
                        success: false
                    }
                }
            }
            input.processedData.data.isBettingStillInProgress = true;
            input.processedData.data.canInsurancePlace = false;
            input.processedData.data.isBettingDoneByAllPlayers = false;
            input.processedData.data.preGameState = input.processedData.table.currentInfo.state
            const tableJoinCollection = DbManager.Instance.masterDb.collection("tablejoinrecord");
            const result = await tableJoinCollection.find({ tableId: input.tableId, isSpectator: true }).toArray();
            let spectatorPlayer: any[] = [];
            result && result.forEach((player) => {
                spectatorPlayer.push(player.playerId)
            })
            input.processedData.data.spectatorPlayer = spectatorPlayer
            resolve(input)
        });

        //checking if any player is in Betting State meaning he hasn't placed his bet yet timer is still going on
        //need to return from Here
        let checkPlayerBettingState = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let bettingPlayers = table.currentInfo.players.filter((player) => player.state === PlayerState.Betting && player.active === true);
            // if still betting players rejecting upfront to not go further
            if (bettingPlayers.length) {
                input.processedData.data.isBettingStillInProgress = true;
                const errorData = { success: false, info: "Game Can't move further as Betting is still going on line checkPlayerBettingState" };
                input.processedData.errorData = errorData;
                reject(input);
                return;//return as code can move further
            } else {
                resolve(input);
            }
        });

        //check min Ready player to move Further
        let checkMinReadyPlayer = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let readyPlayers = table.currentInfo.players.filter((player) => (player.state === PlayerState.Ready || (player.state === PlayerState.Disconnected && player.initialBet > 0)) && player.active === true);
            if (readyPlayers.length) {
                input.processedData.data.startGame = true;
                input.processedData.data.readyPlayers = JSON.parse(JSON.stringify(readyPlayers));
                input.processedData.data.isBettingDoneByAllPlayers = true;
                resolve(input)
            } else {
                //no player has betted 
                //return directly from here and reset table
                input.processedData.data.isBettingDoneByAllPlayers = true;
                reject(input);
                return;
            }
        });

        let resetPlayerState = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            for (let i = 0; i < input.processedData.table.currentInfo.players.length; i++) {
                let player = input.processedData.table.currentInfo.players[i];
                if (player.state === PlayerState.Disconnected && player.initialBet >= table.info.minBuyIn) {
                    //player has placed some bet in betting phase but got Disconnected
                    player.state = PlayerState.Playing;
                    player.active = true;
                    player.isWaitingPlayer = false;
                    // SchedulerHelper.Instance.removeSitoutPlayer(input.tableId, player.playerId);
                }
                if (player.initialBet >= table.info.minBuyIn && player.state === PlayerState.Ready) {
                    player.state = PlayerState.Playing;
                    player.active = true;
                    player.isWaitingPlayer = false;
                }

                if (player.initialBet >= 0 && player.state === PlayerState.Waiting) {
                    player.state = PlayerState.Waiting;
                    player.active = true;
                    player.isWaitingPlayer = false;
                    player.chips = player.chips + player.initialBet
                }
               
            }
            resolve(input);
            //torunament related stuff
        });

        let isGameGoingToStart = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let table: Table = input.processedData.table;
            let waitingPlayers = getPlayersByState(table, PlayerState.Waiting);//table.currentInfo.players.filter(player => (player.state === PlayerState.Waiting));
            let playingPlayers = getPlayersByState(table, PlayerState.Playing);//table.currentInfo.players.filter(player => (player.state === PlayerState.Playing));
            // If less than 1 players then do not start game
            // Do not perform consider player logic. Return function from here
            if (playingPlayers.length < 1) {
                let errorData = ({ success: true, info: 'Less players than to start game - ' + 1 });
                input.processedData.errorData = errorData;
                reject(input); //need to do return else code proceeds to run below
                return;
            } else {
                input.processedData.data.startGame = true;
            }
            resolve(input);
        });

        //need to shuffle the deck if needed before Distributing the cards
        let shuffleDeck = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let table: Table = input.processedData.table;
            let numOfDecks = parseInt(JSON.parse(JSON.stringify(table.info.noOfDeck)))

            let deck: any[] = [];
            while (numOfDecks >= 1) {
                deck = deck.concat(new Deck().getCards());
                numOfDecks--;
            }


            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            table.currentInfo.deck = deck;
            resolve(input);
        });

        let distributeCardsTask = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let response = distributeCards(input.processedData.table);
            input.processedData.data.distributeCardsResponse = response.data;
            resolve(input);
        });

        // ### Sort players indexes
        // > (NOTE: Keep non-playng players at the end of players array list)
        let sortPlayerIndexes = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            // console.log("sortPlayerIndexes")
            let table: Table = input.processedData.table;
            // Refresh player list sorted as seatIndex
            table.currentInfo.players.sort(function (a, b) { return a.seatIndex - b.seatIndex; });
            // serverLog(stateOfX.serverLogType.info, 'players after sort based on seat - ' + JSON.stringify(params.table.players));
            let playingPlayers: any[] = [];
            let inactivePlayer: any[] = [];

            table.currentInfo.players.forEach((player) => {
                if (player.state !== PlayerState.Playing) {
                    // logger.info(player.playerName + ' is not playing, add at last place!')
                    //.info, player.playerName + ' is not playing, add at last place!');
                    inactivePlayer.push(player);
                } else {
                    playingPlayers.push(player);
                    // logger.info(player.playerName + ' is already playing, add at first place!')
                    //.info, player.playerName + ' is already playing, add at first place!');
                }
            })
            table.currentInfo.players = playingPlayers.concat(inactivePlayer);
            resolve(input);
        });

        let checkInsurancePlace = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let dealer = input.processedData.data.distributeCardsResponse.dealer;
            //check for dealer first card as ACE
            if (dealer.hand[0].value === 1) {
                input.processedData.data.canInsurancePlace = true;
            } else {
                input.processedData.data.canInsurancePlace = false;
            }

            //input.processedData.data.canInsurancePlace=true;
            resolve(input)
        });

        //setting players available action based on their available chips and dealer card
        let checkPlayerAvailableAction = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            let players = input.processedData.data.distributeCardsResponse.players;
            players.forEach((player: {
                isInsuranceAsked: boolean; handInfo: { right: any; }; chips: number; initialBet: number;
            }) => {
                let handInfo = player.handInfo.right;
                if (player.chips >= (player.initialBet / 2) && input.processedData.data.canInsurancePlace) {
                    handInfo.availableActions.insurance = true;
                    player.isInsuranceAsked = true;
                } else {
                    handInfo.availableActions.insurance = false;
                }
                handInfo.availableActions.double = handInfo.availableActions.double && player.chips >= (player.initialBet) ? true : false;
                handInfo.availableActions.split = handInfo.availableActions.split && player.chips >= (player.initialBet) ? true : false;
                handInfo.availableActions.surrender = true;
            });
            resolve(input)
        });

        let changeGameState = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            if (input.processedData.data.startGame) {
                input.processedData.table.currentInfo.state = GameState.Running;
            }
            resolve(input);
        });

        //to do 
        // if noBody betted then it's gameOver case
        //reset table again in this case and set playerState again to waiting and Resume Game
        //also if continuous Resume for more than 3 times then don't Resume again and keep everyone at waiting State
        let gamePlayersData = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
            input.processedData.data.dataPlayers = JSON.parse(JSON.stringify(map(input.processedData.table.currentInfo.players, function (player) { return pick(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "active", "handInfo", "initialBet"); })));
            resolve(input);
        });

        let arr: Task<StartGamePayload>[] = [
            initData, checkPlayerBettingState, checkMinReadyPlayer,
            resetPlayerState, isGameGoingToStart, shuffleDeck, distributeCardsTask,
            sortPlayerIndexes, checkInsurancePlace, checkPlayerAvailableAction, changeGameState, gamePlayersData
            // removeSitoutPlayer, removeTournamentPlayers, isEnoughPlayingPlayers, inserRoundId,, ,
            // checkGameStart
        ];
        let pipeline = (new Pipeline<StartGamePayload>());
        arr.forEach((functionRef) => {
            pipeline.pipe(functionRef);
        });

        pipeline.run(input).then((result: StartGamePayload) => {
            clearExistingTimers(input.room as GameRoom)
            resolve(input);

        }, async (input: StartGamePayload) => {

            reject(input);
            await forceUnlockTable(input.tableId);
            return input.processedData.errorData;

        });
    } else {
        console.log("nested Game betting State check done")
        let errorData = { success: false, info: "Game can not start in this State" };
        input.processedData.errorData = errorData;
        await forceUnlockTable(input.tableId);
        reject(input);
    }
});

let fireGamePlayersBroadcast = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
    // logger.info("fireGamePlayersBroadcast started", input)

    // console.log(1)
    // console.log("fireGamePlayersBroadcast");

    if (!input.eventName) {
        input.processedData.errorData = { success: false, info: "missing event name at start game" }
        await forceUnlockTable(input.tableId);
        reject(input);
        return false;
    }
    if (input.processedData.data.preGameState !== GameState.Betting) {
        console.log("some error here.while investigating on Betting state")
        resolve(input);//reject?
        return false;
    }
    if (input.processedData.data.startGame) {//or check data.startGAme
        // console.error('====+++++++', params.data, params.data.dataPlayers, Object.keys(params))
        setTimeout(function () {
            console.log("TablePlayerBroadCast-> 4", JSON.stringify({ tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers }))
            dispatchTablePlayersBroadcast(input.room, { tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers, spectator: input.processedData.data.spectatorPlayer });
        }, (500));
        // todos// firePlayerChipsLobbyBroadcast(pomelo.app, params.channelId, params.channel.channelType, params.data.dataPlayers);
        resolve(input);
        return true;
    } else {
        // input.room.metadata.gameStartEventSet = "IDLE";
        setTimeout(function () {
            console.log("TablePlayerBroadCast-> 5",JSON.stringify({ tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers }))
            dispatchTablePlayersBroadcast(input.room, { tableId: input.processedData.table.id, players: input.processedData.data.dataPlayers, spectator: input.processedData.data.spectatorPlayer });
        }, (500));
        // todos// firePlayerChipsLobbyBroadcast(pomelo.app, params.channelId, params.channel.channelType, params.data.dataPlayers);
        resolve(input);

    }
});

let setOnBreakAndStartReserveTimer = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
    // logger.info("setOnBreakAndStartReserveTimer started", input)
    // console.log(2)

    let isAnyBankrupt = false;

    input.processedData.table.currentInfo.players.forEach((player) => {
        if (player.state === PlayerState.OutOfMoney) {
            isAnyBankrupt = true;
            player.state = PlayerState.OutOfMoney;
            // SchedulerHelper.Instance.removeSitoutPlayer(input.tableId, player.playerId);
            dispatchPlayerStateBroadcast(input.room, { tableId: input.tableId, playerId: player.playerId, playerState: player.state });
        }
    });

    if (isAnyBankrupt) {
        let table = await replaceTable(input.processedData.table).catch(e => { });
        // console.log("after replacing table ", table);
        if (!!table) {
            resolve(input);
        } else {
            input.processedData.errorData = { success: false, info: "failed at replacing table after setting on break to bankrupt players" }
            await forceUnlockTable(input.tableId);
            reject(input);
        }
    } else {
        resolve(input);
    }
});

let checkGameStart = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
    // logger.info("checkGameStart started", input)
    // console.log(3)
    if (input.processedData.data.startGame) {
        input.processedData.data.players = input.processedData.data.distributeCardsResponse.players;
        resolve(input);
    } else {
        let ed = ({ success: false, info: "Sorry, unable to start game on this table" });
        input.processedData.errorData = ed;
        await forceUnlockTable(input.tableId);
        reject(input);
        //cb({success: false, channelId: params.channelId, info: 'No need to start game in this case!'});
    }
});

// Fire broadcast for card distribution
let fireCardDistributeBroadcast = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
    // console.log(4)
    let ts = JSON.parse(JSON.stringify(map(input.processedData.data.players, function (player) { return pick(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "handInfo"); })));
    const dealer=JSON.parse(JSON.stringify(input.processedData.data.distributeCardsResponse.dealer))
    
    setTimeout(function () {
        console.log("***DistributeCardsBroadcAst->",JSON.stringify({ tableId: input.processedData.table.id, players: ts, numCards: input.processedData.data.distributeCardsResponse.numCards, dealer: dealer }))
        dispatchDistributeCardsBroadcast(input.room, { tableId: input.processedData.table.id, players: ts, numCards: input.processedData.data.distributeCardsResponse.numCards, dealer: dealer });
    }, (3000));
    resolve(input);
});

//fire insurance Broadcast
//to do
let fireStartGameBroadcast = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
    // console.log(6)
    setTimeout(function () {
        dispatchStartGameBroadcast(input.room, input.processedData.table);
    }, (600));
    // input.processedData.data.startGameBroadcastData = sgbd;
    let numCards = input.processedData.data.distributeCardsResponse.numCards;
    resolve(input);
});

let fireInsuranceBroadCastAndTimer = new Task<StartGamePayload>((input: StartGamePayload, resolve, reject) => {
    if (input.processedData.data.canInsurancePlace) {

        let ts = JSON.parse(JSON.stringify(map(input.processedData.data.players, function (player) { return pick(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "handInfo"); })));
        const insurancePlayers: any = [];
        ts.forEach((player: {
            isInsuranceAsked: boolean; handInfo: { right: { availableActions: { insurance: boolean; }; }; };
        }) => {
            if (player.handInfo.right.availableActions.insurance) {
                player.isInsuranceAsked = true;
                insurancePlayers.push(player)
            }
        });
        if (insurancePlayers.length) {
            insurancePlayers.forEach((player: { turnTime: number; }) => {
                // player.turnTime = input.processedData.table.info.turnTime || 20;
                player.turnTime = 10;
            })
            input.processedData.table.currentInfo.isInsuranceAsked = true;
            input.processedData.table.currentInfo.state = GameState.Starting;
            let cardDistributeDelay = 1.8;
            let cardAnimDelay = 0;
            let totalPlayer = insurancePlayers.length + 1
            let numCards = 2
            let insuranceTimer = input.room.clock.setTimeout(function (params: any) {

                console.log("insurance Broadcast Fired")
                dispatchInsuranceBroadCasts(input.room, { tableId: input.tableId, players: insurancePlayers })
                startTurnTimer({ room: input.room as GameRoom, table: JSON.parse(JSON.stringify(input.processedData.table)), insuranceTime: true });

            }, ((cardDistributeDelay) * numCards * totalPlayer + cardAnimDelay) * 1000 + 4000, input);
            input.processedData.table.currentInfo.state = GameState.Running;
        } else {
            input.processedData.table.currentInfo.isInsuranceAsked = false;
            input.processedData.data.canInsurancePlace = false;
        }

    }
    resolve(input);
});

let fireOnTurnBroadCast = new Task<StartGamePayload>(async (input: StartGamePayload, resolve, reject) => {
    //fire first turn broadcast For player and handdle additional case of gameover also
    // if insurance occurs then no broadcast For turn
    if (!input.processedData.data.canInsurancePlace) {
        let table = input.processedData.table;
        let players = table.currentInfo.players;
        let currentMoveIndex = table.currentInfo.currentMoveIndex;
        let firstActivePlayer = table.currentInfo.players.find((player) => (player.state === PlayerState.Playing && player.active === true));
        let firstActiveIndex = table.currentInfo.players.indexOf(firstActivePlayer);
        table.currentInfo.firstActiveIndex = firstActiveIndex;
        table.currentInfo.currentMoveIndex = firstActiveIndex;
        console.log('findTurnResponse inside fireOnTurnBroadcast :: ', table)
        let turnResponse = findTurnForPlayers(table, 'right', false);
        table.currentInfo.currentMoveIndex = turnResponse.currentMoveIndex;
        table.currentInfo.currentPlayingPosition = 'right'
        const playerDataTosend: any = turnResponse.isDealerMove ? {} : table.currentInfo.players[turnResponse.currentMoveIndex];
        let dataToSend:any = {}
        if (Object.keys(playerDataTosend).length)
            {dataToSend = {
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
            let cardDistributeDelay = 1.8;
            let cardAnimDelay = 0;
            let numCards = 2;
            let totalPlayer = input.processedData.data.players.length + 1;
            setTimeout(function () {
                console.log("startgame helper 1")
                dispatchOnTurnBroadcast(input.room, { isGameOver: input.processedData.data.isGameOver, turn: { currentMoveData, isDealerMove: true, nextTurnData: {} } });
            }, (((cardDistributeDelay) * numCards * totalPlayer + cardAnimDelay) * 1000 + 4000));
            if (input.processedData.data.isGameOver) {
                setTimeout(function () {
                    dispatchGameOverBroadcast(input.room, { playersResult: response.data.gameOverResponse.playersResult, dealer: response.data.gameOverResponse.dealer })
                }, ((((cardDistributeDelay) * numCards * totalPlayer + cardAnimDelay) * 1000 + 700)) + 4000);

                // restart game if game over occurs
                setTimeout(function () {
                    let payload = {
                        tableId: input.tableId,
                        eventName: <const>"RESUME",

                        room: input.room
                    };
                    processStartGame(payload)
                }, ((((cardDistributeDelay) * numCards * totalPlayer + cardAnimDelay) * 1000)) + 4000 + 5000);
            }
        } else {
            if (!input.processedData.data.canInsurancePlace) {
                let cardDistributeDelay = 1.8;
                let cardAnimDelay = 0;
                let totalPlayer = input.processedData.data.players.length + 1;
                // turndata.turn.player.turnTime = input.processedData.table.info.turnTime || 20;
                turndata.turn.player.turnTime = 10;
                let numCards = input.processedData.data.distributeCardsResponse.numCards;
                let firstTurnTimer = input.room.clock.setTimeout(function (params: any) {
                    //     // only if move is needed : currentMoveIndex >= 1 (for seatIndex) : TODO maybe
                    //     // Send player turn broadcast to channel level
                    console.log("startgame helper 2")
                    dispatchOnTurnBroadcast(input.room, turndata);
                    startTurnTimer({ room: input.room as GameRoom, table: input.processedData.table, isTurnTime: true });

                }, ((cardDistributeDelay) * numCards * totalPlayer + cardAnimDelay) * 1000 + 4000, input);
            }

        }
    }
    input.processedData.table.currentInfo.maxBettingCountOnTable = 1;//indicating max number of continue Betting Phase
    await replaceTable(input.processedData.table);
    resolve(input)
});
