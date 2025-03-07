import { Card, HandValue } from "./types";

import { HandInfoDetail } from "../../dataFormats/InGamePlayer";

export const isNull = (obj?: any): boolean => obj === null

export const isUndefined = (obj?: any): boolean => obj === undefined

export const isNullOrUndef = (obj?: any): boolean => isUndefined(obj) || isNull(obj)

export const calculate = (array: Array<Card>): HandValue | null => {
    if (array.length === 1) {
        if (isNullOrUndef(array[0])) {
            return null
        }
        const value = array[0].value
        return {
            hi: value === 1 ? 11 : value,
            lo: value === 1 ? 1 : value
        }
    }
    const aces: number[] = []
    const value = array.reduce((memo, x) => {
        if (x.value === 1) {
            aces.push(1)
            return memo
        }
        memo += x.value
        return memo
    }, 0)
    return aces.reduce((memo) => {
        if ((memo.hi + 11) <= 21) {
            memo.hi += 11
            memo.lo += 1
        } else {
            memo.hi += 1
            memo.lo += 1
        }
        if (memo.hi > 21 && memo.lo <= 21) {
            memo.hi = memo.lo
        }
        return memo
    }, {
        hi: value,
        lo: value
    })
}

export const getHigherValidValue = (handValue: HandValue): number => handValue.hi <= 21 ? handValue.hi : handValue.lo

export const checkForBusted = (handValue: HandValue): boolean => (handValue.hi > 21) && (handValue.lo === handValue.hi)

export const isBlackjack = (array: Array<Card>): boolean => array.length === 2 && calculate(array)?.hi === 21;

export const isSoftHand = (array: Array<Card>): boolean => {
    return array.some(x => x.value === 1) &&
        array
            .reduce((memo, x) => {
                memo += (x.value === 1 && memo < 11) ? 11 : x.value
                return memo
            }, 0) === 17
}



export const countCards = (array: Array<Card>) => {
    const systems = {
        'Hi-Lo': [-1, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1]
    }
    return array.reduce((memo, x) => {
        memo += systems['Hi-Lo'][x.value - 1]
        return memo
    }, 0)
}


export const isPerfectPairs = (playerCards: Array<Card>): boolean => playerCards[0].value === playerCards[1].value;

export const getHandInfo = (playerCards: Array<Card>, dealerCards: Array<Card>, hasSplit: boolean = false) => {
    const handValue = calculate(playerCards)
    if (!handValue) {
        return null
    }
    const hasBlackjack = isBlackjack(playerCards) //&& hasSplit === false
    const hasBusted = checkForBusted(handValue)
    const isClosed = hasBusted || hasBlackjack || handValue.hi === 21 || (hasSplit && playerCards[0].name === 'A')
    const canDoubleDown = !isClosed && true && (handValue.hi === 9 || handValue.hi === 10 || handValue.hi === 11);
    const canSplit = playerCards.length > 1 && playerCards[0].value === playerCards[1].value && !isClosed && hasSplit === false;
    const canInsure = dealerCards[0].value === 1 && !isClosed
    return {
        cards: playerCards,
        handValue: handValue,
        hasBlackjack: hasBlackjack,
        hasBusted: hasBusted,
        // playerHasSurrendered: false,
        close: isClosed,
        availableActions: {
            double: canDoubleDown,
            split: canSplit,
            insurance: canInsure,
            hit: !isClosed,
            stand: !isClosed,
            surrender:!hasBusted
            // surrender: !isClosed
        }
    }
}

export const getHandInfoForSplit = (playerCards: Array<Card>, dealerCards: Array<Card>, hasSplit: boolean = false) => {
    const handValue = calculate(playerCards)
    if (!handValue) {
        return null
    }
    const hasBlackjack = false;
    const hasBusted = false;
    const isClosed = false;
    const canDoubleDown = false;
    const canSplit = false;
    const canInsure = false;
    return {
        cards: playerCards,
        handValue: handValue,
        hasBlackjack: hasBlackjack,
        hasBusted: hasBusted,
        close: isClosed,
        availableActions: {
            double: canDoubleDown,
            split: canSplit,
            insurance: canInsure,
            hit: !isClosed,
            stand: !isClosed,
            surrender: !isClosed
        }
    }
}


export const getHandInfoAfterDeal = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number): any => {
    const hand = getHandInfo(playerCards, dealerCards)
    
    const availableActions = hand.availableActions
    hand.availableActions = {
        ...availableActions,
        stand: true,
        hit: true,
        surrender: true
    }
    return {
        ...hand,
        close: hand.hasBlackjack
    }
}


export const getHandInfoAfterSplit = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number): any => {
    const hand = getHandInfoForSplit(playerCards, dealerCards, true)
    const availableActions = hand.availableActions
    hand.availableActions = {
        ...availableActions,
        split: false,
        double: false,
        insurance: false,
        // surrender: true
        surrender: false
    }
    return hand
}

export const getHandInfoAfterHit = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number, hasSplit: boolean): any => {
    const hand = getHandInfo(playerCards, dealerCards, hasSplit)
    const availableActions = hand.availableActions
    hand.availableActions = {
        ...availableActions,
       
        split: false,
        insurance: false,
        // surrender: false
    }
    return hand
}

export const getHandInfoAfterDouble = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number, hasSplit: boolean): HandInfoDetail => {
    const hand = getHandInfoAfterHit(playerCards, dealerCards, initialBet, hasSplit)
    const availableActions = hand.availableActions
    hand.availableActions = {
        ...availableActions,
        double:false,
        hit: false,
        stand: false
    }
    hand.initialBet = hand.initialBet * 2
    return {
        ...hand,
        close: true
    }
}

export const getHandInfoAfterStand = (handInfo: HandInfoDetail): HandInfoDetail => {
    return {
        ...handInfo,
        close: true,
        availableActions: {
            double: false,
            split: false,
            insurance: false,
            hit: false,
            stand: false,
            // surrender: true
            surrender: false
        }
    }
}






