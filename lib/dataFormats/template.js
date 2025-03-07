"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
const uuid = require('uuid');
class Template {
    constructor(data) {
        this.createTemplateData(data);
        this.temp();
    }
    createTemplateData(data) {
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
exports.Template = Template;
