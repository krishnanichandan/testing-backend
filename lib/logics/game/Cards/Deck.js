"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deck = void 0;
const Card_1 = require("./Card");
class Deck {
    constructor(numDecks = 1) {
        this.decks = [];
        this.types = {
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
        this.initMixedDecks(numDecks);
    }
    initMixedDecks(numDecks) {
        for (let i = 0; i < numDecks; i++) {
            this.decks.push(this.createDeck());
        }
        this.shuffle();
    }
    createDeck() {
        const deck = [];
        for (const type in this.types) {
            for (let rank = 1; rank <= 13; rank++) {
                deck.push(new Card_1.Card(type, rank));
            }
        }
        return deck;
    }
    getCards() {
        return this.decks.flat();
    }
    getRandomArbitrary(min, max) {
        return Math.round(Math.random() * (max - min) + min);
    }
    // shuffle cards deck 
    shuffle() {
        for (let i = 0; i < this.decks.length; i++) {
            var len = this.decks[i].length, tempVal, randIdx;
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
exports.Deck = Deck;
