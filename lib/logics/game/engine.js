"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHandInfoAfterStand = exports.getHandInfoAfterDouble = exports.getHandInfoAfterHit = exports.getHandInfoAfterSplit = exports.getHandInfoAfterDeal = exports.getHandInfoForSplit = exports.getHandInfo = exports.isPerfectPairs = exports.countCards = exports.isSoftHand = exports.isBlackjack = exports.checkForBusted = exports.getHigherValidValue = exports.calculate = exports.isNullOrUndef = exports.isUndefined = exports.isNull = void 0;
const isNull = (obj) => obj === null;
exports.isNull = isNull;
const isUndefined = (obj) => obj === undefined;
exports.isUndefined = isUndefined;
const isNullOrUndef = (obj) => (0, exports.isUndefined)(obj) || (0, exports.isNull)(obj);
exports.isNullOrUndef = isNullOrUndef;
const calculate = (array) => {
    if (array.length === 1) {
        if ((0, exports.isNullOrUndef)(array[0])) {
            return null;
        }
        const value = array[0].value;
        return {
            hi: value === 1 ? 11 : value,
            lo: value === 1 ? 1 : value
        };
    }
    const aces = [];
    const value = array.reduce((memo, x) => {
        if (x.value === 1) {
            aces.push(1);
            return memo;
        }
        memo += x.value;
        return memo;
    }, 0);
    return aces.reduce((memo) => {
        if ((memo.hi + 11) <= 21) {
            memo.hi += 11;
            memo.lo += 1;
        }
        else {
            memo.hi += 1;
            memo.lo += 1;
        }
        if (memo.hi > 21 && memo.lo <= 21) {
            memo.hi = memo.lo;
        }
        return memo;
    }, {
        hi: value,
        lo: value
    });
};
exports.calculate = calculate;
const getHigherValidValue = (handValue) => handValue.hi <= 21 ? handValue.hi : handValue.lo;
exports.getHigherValidValue = getHigherValidValue;
const checkForBusted = (handValue) => (handValue.hi > 21) && (handValue.lo === handValue.hi);
exports.checkForBusted = checkForBusted;
const isBlackjack = (array) => { var _a; return array.length === 2 && ((_a = (0, exports.calculate)(array)) === null || _a === void 0 ? void 0 : _a.hi) === 21; };
exports.isBlackjack = isBlackjack;
const isSoftHand = (array) => {
    return array.some(x => x.value === 1) &&
        array
            .reduce((memo, x) => {
            memo += (x.value === 1 && memo < 11) ? 11 : x.value;
            return memo;
        }, 0) === 17;
};
exports.isSoftHand = isSoftHand;
const countCards = (array) => {
    const systems = {
        'Hi-Lo': [-1, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1]
    };
    return array.reduce((memo, x) => {
        memo += systems['Hi-Lo'][x.value - 1];
        return memo;
    }, 0);
};
exports.countCards = countCards;
const isPerfectPairs = (playerCards) => playerCards[0].value === playerCards[1].value;
exports.isPerfectPairs = isPerfectPairs;
const getHandInfo = (playerCards, dealerCards, hasSplit = false) => {
    const handValue = (0, exports.calculate)(playerCards);
    if (!handValue) {
        return null;
    }
    const hasBlackjack = (0, exports.isBlackjack)(playerCards); //&& hasSplit === false
    const hasBusted = (0, exports.checkForBusted)(handValue);
    const isClosed = hasBusted || hasBlackjack || handValue.hi === 21 || (hasSplit && playerCards[0].name === 'A');
    const canDoubleDown = !isClosed && true && (handValue.hi === 9 || handValue.hi === 10 || handValue.hi === 11);
    const canSplit = playerCards.length > 1 && playerCards[0].value === playerCards[1].value && !isClosed && hasSplit === false;
    const canInsure = dealerCards[0].value === 1 && !isClosed;
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
            surrender: !hasBusted
            // surrender: !isClosed
        }
    };
};
exports.getHandInfo = getHandInfo;
const getHandInfoForSplit = (playerCards, dealerCards, hasSplit = false) => {
    const handValue = (0, exports.calculate)(playerCards);
    if (!handValue) {
        return null;
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
    };
};
exports.getHandInfoForSplit = getHandInfoForSplit;
const getHandInfoAfterDeal = (playerCards, dealerCards, initialBet) => {
    const hand = (0, exports.getHandInfo)(playerCards, dealerCards);
    const availableActions = hand.availableActions;
    hand.availableActions = Object.assign(Object.assign({}, availableActions), { stand: true, hit: true, surrender: true });
    return Object.assign(Object.assign({}, hand), { close: hand.hasBlackjack });
};
exports.getHandInfoAfterDeal = getHandInfoAfterDeal;
const getHandInfoAfterSplit = (playerCards, dealerCards, initialBet) => {
    const hand = (0, exports.getHandInfoForSplit)(playerCards, dealerCards, true);
    const availableActions = hand.availableActions;
    hand.availableActions = Object.assign(Object.assign({}, availableActions), { split: false, double: false, insurance: false, 
        // surrender: true
        surrender: false });
    return hand;
};
exports.getHandInfoAfterSplit = getHandInfoAfterSplit;
const getHandInfoAfterHit = (playerCards, dealerCards, initialBet, hasSplit) => {
    const hand = (0, exports.getHandInfo)(playerCards, dealerCards, hasSplit);
    const availableActions = hand.availableActions;
    hand.availableActions = Object.assign(Object.assign({}, availableActions), { split: false, insurance: false });
    return hand;
};
exports.getHandInfoAfterHit = getHandInfoAfterHit;
const getHandInfoAfterDouble = (playerCards, dealerCards, initialBet, hasSplit) => {
    const hand = (0, exports.getHandInfoAfterHit)(playerCards, dealerCards, initialBet, hasSplit);
    const availableActions = hand.availableActions;
    hand.availableActions = Object.assign(Object.assign({}, availableActions), { double: false, hit: false, stand: false });
    hand.initialBet = hand.initialBet * 2;
    return Object.assign(Object.assign({}, hand), { close: true });
};
exports.getHandInfoAfterDouble = getHandInfoAfterDouble;
const getHandInfoAfterStand = (handInfo) => {
    return Object.assign(Object.assign({}, handInfo), { close: true, availableActions: {
            double: false,
            split: false,
            insurance: false,
            hit: false,
            stand: false,
            // surrender: true
            surrender: false
        } });
};
exports.getHandInfoAfterStand = getHandInfoAfterStand;
