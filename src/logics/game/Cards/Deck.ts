import { Card } from "./Card";

export class Deck {
    decks: Card[][] = [];
    types = {
        'heart': {
            priority: 3
        },
        'spade': {
            priority: 4
        },
        'diamond': {
            priority: 2
        },
        'club': {
            priority: 1
        }
    };
    
    constructor(numDecks: number = 1) {
        this.initMixedDecks(numDecks);
    }

    initMixedDecks(numDecks: number) {
        for (let i = 0; i < numDecks; i++) {
            this.decks.push(this.createDeck());
        }
        this.shuffle();
    }

    createDeck(): Card[] {
        const deck: Card[] = [];
        for (const type in this.types) {
            for (let rank = 1; rank <= 13; rank++) {
                deck.push(new Card(type as "heart" | "spade" | "diamond" | "club", rank));
            }
        }
        return deck;
    }

    getCards(): Card[] {
        return this.decks.flat();
    }


    getRandomArbitrary(min: number, max: number) {
        return Math.round(Math.random() * (max - min) + min);
    }
    
    // shuffle cards deck 
    shuffle() {
        for (let i = 0; i < this.decks.length; i++) {
            var len = this.decks[i].length,
                tempVal, randIdx;
            while (0 !== len) {
                randIdx = Math.floor(Math.random() * len);
                len--;
                tempVal = this.decks[i][len];
                this.decks[i][len] = this.decks[i][randIdx];
                this.decks[i][randIdx] = tempVal;
            }
        }
    }

   
}