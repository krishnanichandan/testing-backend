const uuid = require('uuid');
//#region Template
export interface Templates {
    id: string;
    name: string;
    displayName: string;
    isActive: boolean;
    minBet: number;
    maxBet: number;
    maxNoOfPlayers: number;
    noOfDeck: number;
    turnTime: number;
    createdAt: number;
    updatedAt: number;
    timeOnDevice: number;
}

interface createTemplatePayload {
    name: string;
    displayName: string;
    // gameType: GameType;
    isActive: boolean;
    minBet: number;
    maxBet: number;
    maxNoOfPlayers: number;
    noOfDeck: number;
    turnTime: number;
    createdAt: number;
    updatedAt: number;
    timeOnDevice: number;
}

export class Template implements Templates {
    id: string;
    name: string;
    displayName: string;
    // gameType: GameType;
    isActive: boolean;
    minBet: number;
    maxBet: number;
    maxNoOfPlayers: number;
    noOfDeck: number;
    turnTime: number;
    createdAt: number;
    updatedAt: number;
    timeOnDevice: number;
    _id?: any;

    constructor(data: createTemplatePayload) {
        this.createTemplateData(data);
        this.temp();
    }

    createTemplateData(data: createTemplatePayload) {
        this.id = uuid.v4();
        this.name = data.name;
        this.minBet = data.minBet;
        this.maxBet = data.maxBet;
        this.turnTime = data.turnTime;
        this.displayName = data.displayName;
        this.isActive = data.isActive;
        this.maxNoOfPlayers = data.maxNoOfPlayers;
        this.noOfDeck = data.noOfDeck;
        this.timeOnDevice = data.timeOnDevice;
        this.createdAt = Number(new Date());
        this.updatedAt = Number(new Date());
    }

    temp() {
        //Db query for run time creation
    }
}


