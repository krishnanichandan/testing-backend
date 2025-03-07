export class Card {
    type: "heart" | "spade" | "diamond" | "club";
    value: number;
    name: string;
    priority: any;
    constructor(type: string, rank: number) {
        this.type = <"heart" | "spade" | "diamond" | "club">type;
        this.value = rank;
        this.name = this.getName();

        if (this.value > 9) {
            this.value = 10;
        }
    }

  

    getName(): string {
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
    };
}