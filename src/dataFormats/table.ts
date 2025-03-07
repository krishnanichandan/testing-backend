import { GameState, HandValue } from "../logics/game/types";

import { Card } from "../logics/game/Cards/Card";
import { Deck } from "../logics/game/Cards/Deck";
import { InGamePlayer } from "./InGamePlayer";

const uuid = require('uuid');

//#region Table
interface Tables {
    id: string;
    info: BasicTableInfo;
    currentInfo: DynamicInfo;
}

interface BasicTableInfo {
    name: string;
    minBuyIn: number;
    maxBuyIn: number;
    maxBetAllowed: number;
    gameInfo: string;
    turnTime: number;
    rakeRules: string;
    noOfDeck: number;
    isSinglePlayerTable: boolean;
    rake: {
        rakePercent: number;
        cap: number;
    };
    gameInterval: number;
    isRealMoney: boolean;
    gameRulesConfig: GameRules[];
    createdAt: number;
    modifiedAt: number;
    status: number;
    game_text1: string;
    game_text2: string;
    game_text3: string;
}

export interface CreateTablePayload {
    isSinglePlayerTable: boolean;
    name: string;
    turnTime: number;
    minBet: number;
    maxBet: number;
    noOfDeck: number;
    maxNoOfPlayers: number;
    rake?: number;
    isRealMoney?: boolean;
    game_text1: string;
    game_text2: string;
    game_text3: string;
}

export type GameRules = {
    _id: string;
    id: string;
    name: string;
    displayName: string;
    description: string;
    numOfDecks: number;
    numOfCardsPerDeck: number;
    createdBy: string;
    createdTime: number;
    modifiedBy: string;
    modifiedTime: number;
    rankingToSuits: any;
    isSoftHand17: boolean;
}

interface DynamicInfo {
    roundId: string;
    showBetPhaseContinuePopUpRemaining: boolean;
    state: string;
    stateInternal: string;
    roundCount: number;
    players: InGamePlayer[],
    isInsurancePlacedOnTable: boolean;
    isInsuranceAsked: boolean;
    onStartPlayers: any[],
    remainingMoveTime: number;
    dealerIndex: number;
    dealerSeatIndex: number;//same as above?
    dealer: Dealer
    currentMoveIndex: number;//in case of Dealer it's -1
    shuffleDeckInNextGame: boolean;

    firstActiveIndex: number;

    deck: Card[];//cards
    isBettingRoundLocked: boolean;

    turnTimeStartAt: number;
    isOperationOn: boolean;
    actionName: string;
    operationStartTime: number;
    operationEndTime: number;
    currentPlayingPosition: string;
    gameStartTime: number;

    vacantSeats: number;
    occupiedSeats: number;
    _v: number;
    roundNumber: string;

    maxBettingCountOnTable: number

}
export interface Dealer {
    hand: Card[];
    holdCard: Card;
    isHoldCardOpened: boolean;
    totalPoints: HandValue;
    isSoft17: boolean;
    isBusted: boolean;
    hasBlackjack: boolean;
    isVisible: boolean;
}

export class Table implements Tables {
    id: string;
    info: BasicTableInfo;
    currentInfo: DynamicInfo;

    constructor(data: CreateTablePayload) {
        this.createTableData(data);
        this.temp();
    }

    createTableData(data: CreateTablePayload) {
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
        }

        this.currentInfo = {
            state: GameState.Idle,
            stateInternal: GameState.Starting,
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
            dealerSeatIndex: 0,//same as above?
            dealer: {
                hand: [],
                holdCard: {} as Card,
                isHoldCardOpened: false,
                totalPoints: {} as HandValue,
                isSoft17: false,
                isBusted: false,
                hasBlackjack: false,
                isVisible: false,
            },
            currentMoveIndex: -1,
            deck: new Deck(data.noOfDeck).getCards(),//currently 1 deck

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

    getTable(): Table {
        return this;
    }
}