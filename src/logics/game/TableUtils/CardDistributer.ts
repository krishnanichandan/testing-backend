import *  as engine from "../engine"

import { Dealer, Table } from "../../../dataFormats/table";
import { HandInfoDetail, InGamePlayer } from "../../../dataFormats/InGamePlayer";
import { popCard, totalActivePlayers } from "./TableHelper";

// Distribute card to players after locking table object
export function distributeCards(table: Table): any {
    // logger.info('distributeCards called', { tableId: table.id });
    let totalActivePlayersResponse = totalActivePlayers({ table: table });//(params, function () {
    if (totalActivePlayersResponse.success) {
        const numCards = 2;
        const dealerCards = popCard(table, numCards);
        const dealer: Dealer = JSON.parse(JSON.stringify(table.currentInfo.dealer))
        dealer.hand = [dealerCards.cards[0]];
       
        dealer.holdCard = dealerCards.cards[1];
       
        dealer.totalPoints = engine.calculate(dealer.hand);
        const dealerHand = dealer.hand.concat(dealer.holdCard);
        const dealerTotalPoint = engine.calculate(dealerHand);
        // Iterate over player to distribute card

        totalActivePlayersResponse.players.forEach((activePlayer: InGamePlayer) => {
            // input.data.count = numCards;
            let popCardResponse = popCard(table, numCards);//, function (popCardResponse) {
            const playerCards = popCardResponse.cards;
           
            const handInfo = (engine.getHandInfo(playerCards, dealerHand, false)) as HandInfoDetail;
            handInfo.initialBet = activePlayer.initialBet;
            activePlayer.handInfo.right = handInfo
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
};

