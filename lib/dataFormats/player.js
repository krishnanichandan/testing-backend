"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const uuid = require('uuid');
const shortid = require('shortid32');
shortid.characters('QWERTYUIOPASDFGHJKLZXCVBNM012345');
;
//#endregion
class Player {
    constructor(data, justNumber = false) {
        if (!!justNumber) {
            this.createDataForUser(data);
        }
        else {
            this.createDataForUser(data);
        }
        this.temp();
    }
    createDataForUser(userData) {
        this.info = {
            name: !!userData && userData.userName ? userData.userName : "",
            firstName: !!userData && userData.firstName ? userData.firstName : "",
            lastName: !!userData && userData.lastName ? userData.lastName : "",
            mobileNumber: !!userData && userData.phone ? userData.phone : "",
            avatar: !!userData && userData.avatar_url ? userData.avatar_url : "",
            address: {
                city: "",
                state: !!userData && userData.pl_location_state ? userData.pl_location_state : "",
                country: !!userData && userData.pl_location_country ? userData.pl_location_country : "",
                tier: !!userData && userData.tier ? userData.tier : ""
            },
            createdAt: new Date().toISOString()
        };
        this.loginInfo = {
            callback_token: !!userData && userData.callback_token ? userData.callback_token : "",
            callback_url: !!userData && userData.callback_url ? userData.callback_url : "",
            isCallback_tokenRefereshed: true,
            lastLogin: new Date().toISOString(),
            game_timeout_min: !!userData && userData.game_timeout_min ? userData.game_timeout_min : 25
        };
        this.accountInfo = {
            realChips: !!userData && userData.tusks_bal ? userData.tusks_bal : 0,
        };
        this.playerId = userData.playerID;
        this.ivoreeId = userData.playerID;
        this.casinoTenentId = userData.casinoTenentId || "";
        this.preferences = {
            muteGameMusic: false,
            muteGameSound: false,
            felt_url: !!userData && userData.card_url ? userData.card_url : "",
            card_url: !!userData && userData.card_url ? userData.card_url : ""
        };
        this.additionalInfo = {
            game_text1: userData.game_text1 || "",
            game_text2: userData.game_text2 || "",
            game_text3: userData.game_text3 || ""
        };
    }
    ;
    temp() {
        this.accountInfo.realChips = 10000;
    }
}
exports.Player = Player;
