"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
class Card {
    constructor(type, rank) {
        this.type = type;
        this.value = rank;
        this.name = this.getName();
        if (this.value > 9) {
            this.value = 10;
        }
    }
    getName() {
        switch (this.value) {
            case 1:
                return "A";
            case 11:
                return "J";
            case 12:
                return "Q";
            case 13:
                return "K";
            default:
                return this.value.toString();
        }
    }
    ;
}
exports.Card = Card;
