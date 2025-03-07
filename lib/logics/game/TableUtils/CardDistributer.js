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
Object.defineProperty(exports, "__esModule", { value: true });
exports.distributeCards = void 0;
const engine = __importStar(require("../engine"));
const TableHelper_1 = require("./TableHelper");
// Distribute card to players after locking table object
function distributeCards(table) {
    // logger.info('distributeCards called', { tableId: table.id });
    let totalActivePlayersResponse = (0, TableHelper_1.totalActivePlayers)({ table: table }); //(params, function () {
    if (totalActivePlayersResponse.success) {
        const numCards = 2;
        const dealerCards = (0, TableHelper_1.popCard)(table, numCards);
        const dealer = JSON.parse(JSON.stringify(table.currentInfo.dealer));
        dealer.hand = [dealerCards.cards[0]];
        dealer.holdCard = dealerCards.cards[1];
        dealer.totalPoints = engine.calculate(dealer.hand);
        const dealerHand = dealer.hand.concat(dealer.holdCard);
        const dealerTotalPoint = engine.calculate(dealerHand);
        // Iterate over player to distribute card
        totalActivePlayersResponse.players.forEach((activePlayer) => {
            // input.data.count = numCards;
            let popCardResponse = (0, TableHelper_1.popCard)(table, numCards); //, function (popCardResponse) {
            const playerCards = popCardResponse.cards;
            const handInfo = (engine.getHandInfo(playerCards, dealerHand, false));
            handInfo.initialBet = activePlayer.initialBet;
            activePlayer.handInfo.right = handInfo;
            //Distribute cards to each player here
        });
        dealer.isHoldCardOpened = false;
        dealer.isSoft17 = false;
        dealer.hasBlackjack = false;
        dealer.isBusted = false;
        dealer.isVisible = false;
        table.currentInfo.dealer = dealer;
        //DistributeCard to Dealer also
        // logger.info('Cards distributed to player', { players: totalActivePlayersResponse.players, numCards: numCards });
        return ({ success: true, data: { players: totalActivePlayersResponse.players, numCards: numCards, dealer: dealer } });
    }
    else {
        return (totalActivePlayersResponse);
    }
}
exports.distributeCards = distributeCards;
;
