"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Table = void 0;
const types_1 = require("../logics/game/types");
const Deck_1 = require("../logics/game/Cards/Deck");
const uuid = require('uuid');
class Table {
    constructor(data) {
        this.createTableData(data);
        this.temp();
    }
    createTableData(data) {
        this.id = uuid.v4();
        this.info = {
            name: "Ivoree" + new Date().toISOString(),
            isSinglePlayerTable: data.isSinglePlayerTable,
            minBuyIn: data.minBet,
            maxBuyIn: data.maxBet,
            maxBetAllowed: 0,
            turnTime: data.turnTime,
            gameInfo: "",
            rakeRules: "",
            noOfDeck: data.noOfDeck,
            rake: {
                rakePercent: 0,
                cap: 0
            },
            gameInterval: 1,
            isRealMoney: true,
            gameRulesConfig: [],
            createdAt: Number(new Date()),
            modifiedAt: Number(new Date()),
            status: 1,
            game_text1: data.game_text1 || "",
            game_text2: data.game_text2 || "",
            game_text3: data.game_text3 || ""
        };
        this.currentInfo = {
            state: types_1.GameState.Idle,
            stateInternal: types_1.GameState.Starting,
            showBetPhaseContinuePopUpRemaining: false,
            roundCount: 1,
            players: [],
            onStartPlayers: [],
            isInsurancePlacedOnTable: false,
            isInsuranceAsked: false,
            remainingMoveTime: -1,
            shuffleDeckInNextGame: false,
            firstActiveIndex: -1,
            dealerIndex: 0,
            dealerSeatIndex: 0, //same as above?
            dealer: {
                hand: [],
                holdCard: {},
                isHoldCardOpened: false,
                totalPoints: {},
                isSoft17: false,
                isBusted: false,
                hasBlackjack: false,
                isVisible: false,
            },
            currentMoveIndex: -1,
            deck: new Deck_1.Deck(data.noOfDeck).getCards(), //currently 1 deck
            isBettingRoundLocked: false,
            turnTimeStartAt: null,
            isOperationOn: false,
            actionName: "",
            currentPlayingPosition: "right",
            operationStartTime: -1,
            operationEndTime: -1,
            gameStartTime: -1,
            vacantSeats: data.maxNoOfPlayers,
            occupiedSeats: 0,
            _v: 1,
            roundNumber: "",
            roundId: "",
            maxBettingCountOnTable: 1
        };
    }
    temp() {
    }
    getTable() {
        return this;
    }
}
exports.Table = Table;
