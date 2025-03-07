import { Card } from "../logics/game/Cards/Card";
import { Player } from "./player";
import { PlayerMove } from "../logics/game/gameConstants";
import { PlayerState } from "../logics/game/types";

export type InGamePlayer = {
    turnTime: number;
    roundId: string;
    playerId: string;
    tableId: string;
    playerName: string;
    leavePossible: boolean;
    active: boolean; //ie disconnected or fold or allin
    chips: number;//total chips
    initialBet: number;
    handInfo: HandInfo;
    hasBlackJack: boolean;
    hasPlacedInsurance: boolean;
    isInsuranceAsked: boolean;
    history: History[]
    instantBonusAmount: number;
    seatIndex: number;
    avatar: any;
    state: PlayerState;
    // previousState?: PlayerState | '';
    previousState?: PlayerState ;

    lastBet: number;
    totalRoundBet: number;
    totalGameBet: number;
    settings: any;
    isAutoReBuy: boolean;
    autoReBuyAmount: number;
    isPlayed: boolean;
    sideBet: number;
    onSitBuyIn: number;
    onGameStartBuyIn: number;
    chipsToBeAdded: number;
    hasPlayedOnceOnTable: boolean;
    totalGames: number;
    isWaitingPlayer: boolean;
    disconnectedMissed: number;
    sitoutGameMissed: number;
    insuranceActionTaken:boolean;

    isRunItTwice: boolean;

    playerGame_timeOut_min: number;



    networkIp?: string;
    deviceType?: string;

    isDisconnected: boolean;
    activityRecord?: any;
    playerPlaySession: number;
    playerPlaySessionExceeded:boolean;
    playerDealtInLastRound:boolean;
    showContinueBetPopUp:boolean;
    previouslyPopUpShowed:boolean;

    totalBetOnTable: number;
    chipsIn: number;


    stats: Player["statistics"];
    
}
export type History = {
    type: PlayerMove,
    card: Card[],
    amount: number,
    playedPosition?: keyof HandInfo,
    isInurancePlace?: boolean;
    handValue?: HandValue//symbolizing count of cards till this move
}
export type HandInfo = {
    left: HandInfoDetail,
    right: HandInfoDetail
}
export type HandInfoDetail = {
    cards: Card[],
    handValue: HandValue,
    hasBusted: boolean,
    hasBlackjack: boolean,
    close: boolean,
    initialBet: number
    availableActions: AvailableActions
}
type AvailableActions = {
    double: boolean,
    split: boolean,
    insurance: boolean,
    hit: boolean,
    stand: boolean,
    surrender: boolean
}
type HandValue = {
    hi: number;
    lo: number;
}
type cards = {
    rank: number;
    suit: Suit;
    type: string;
}

enum Suit {
    Heart = "Heart",
    Club = "Club",
    Spade = "Spade",
    Diamond = "Diamond"
}


export function createInGamePlayer(playerData: Partial<InGamePlayer>, tableMaxBuyIn: number, fullPlayerData: Player): InGamePlayer {
    let newPlayer: InGamePlayer = {
        playerId: playerData.playerId,
        tableId: playerData.tableId,
        chips: Math.trunc(playerData.chips),
        seatIndex: playerData.seatIndex,
        playerName: playerData.playerName,
        networkIp: playerData.networkIp,
        deviceType: playerData.deviceType,
        instantBonusAmount: Math.trunc(playerData.instantBonusAmount) || 0,
        avatar: fullPlayerData.info.avatar,
        state: playerData.state || PlayerState.Waiting,
        onGameStartBuyIn: Math.trunc(playerData.chips),
        onSitBuyIn: Math.trunc(playerData.chips),
        isAutoReBuy: playerData.isAutoReBuy || false,
        playerPlaySession: Date.now(),
        playerPlaySessionExceeded: false,
        playerDealtInLastRound: false,
        showContinueBetPopUp: false,
        previouslyPopUpShowed: false,

        totalBetOnTable: 0,
        chipsIn: Math.trunc(fullPlayerData.accountInfo.realChips),
        playerGame_timeOut_min: fullPlayerData.loginInfo.game_timeout_min,


        active: false,

        lastBet: 0,
        sideBet: 0,
        totalRoundBet: 0,
        totalGameBet: 0,
        autoReBuyAmount: 0,
        isPlayed: false,
        chipsToBeAdded: 0,
        turnTime: Date.now(),

        hasPlayedOnceOnTable: false,
        insuranceActionTaken: false,

        isWaitingPlayer: true,
        disconnectedMissed: 0,
        sitoutGameMissed: 0,
        isInsuranceAsked: false,

        isDisconnected: false,
        isRunItTwice: false,
        totalGames: 0,

        stats: fullPlayerData.statistics,
        leavePossible: false,
        initialBet: 0,
        handInfo: {
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
        },
        hasBlackJack: false,
        hasPlacedInsurance: false,
        history: [],
        roundId: "",
        settings: fullPlayerData.preferences
    };

    return newPlayer;
}