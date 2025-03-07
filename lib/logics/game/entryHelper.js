"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onEntryRequest = void 0;
const masterQueries_1 = require("../../db/masterQueries");
const player_1 = require("../../dataFormats/player");
const test_1 = require("./test");
const availableTableHelper_1 = require("./availableTableHelper");
const unique_username_generator_1 = require("unique-username-generator");
function onEntryRequest(data) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(data.encodedData);
        if (!data.encodedData) {
            return { success: false, info: "Incomplete request" };
        }
        const validJsonString = data.encodedData.replace(/([a-zA-Z0-9]+)\s*:/g, '"$1":');
        const jsonString = validJsonString.replace(/:([^,}\]]+)/g, ':"$1"');
        // Parse the valid JSON string into a JavaScript object
        const jsonObject = JSON.parse(jsonString);
        if (!jsonObject) {
            return { success: false, info: "Incomplete request" };
        }
        const decryptedEncodedData = yield (0, test_1.decryptData)(jsonObject.data);
        const realData = JSON.parse(decryptedEncodedData);
        if (!realData.casinoTenentId) {
            return { success: false, info: "Incomplete request" };
        }
        //fetch player using arbitrary Id
        const filter = {
            playerId: realData.playerID
        };
        const updateFeilds = {
            "loginInfo.lastLogin": new Date().toISOString(),
            "loginInfo.callback_token": realData.callback_token,
            "loginInfo.callback_url": realData.callback_url,
            "loginInfo.isCallback_tokenRefereshed": true,
            "loginInfo.game_timeout_min": realData.game_timeout_min,
            "info.avatar": realData.avatar_url,
            "preferences.felt_url": realData.felt_url,
            "preferences.card_url": realData.card_url,
            "info.firstName": realData.firstName,
            "info.lastName": realData.lastName,
            "info.name": realData.firstName + " " + realData.lastName
        };
        let player = yield (0, masterQueries_1.findAndUpdateUser)(filter, updateFeilds);
        // let player: Player = await findUser({ playerId: realData.playerID })//Db call
        if (!!player && player.ok && player.value) {
            const result = JSON.parse(JSON.stringify(player.value));
            delete result.loginInfo;
            delete result.ivoreeId;
            delete result._id;
            delete result.info.address;
            delete result.info.createdAt;
            delete result.info.firstName;
            delete result.info.lastName;
            delete result.info.mobileNumber;
            let availableTable = yield (0, availableTableHelper_1.findAvailableOrCreateRoom)({ playerId: realData.playerID, client: data.client, isSinglePlayerTable: realData.multi_play ? false : true });
            return { success: true, playerInfo: result, isMultiPlayer: realData.multi_play, firstTimeUser: false, tableId: availableTable.response.tableId };
        }
        else {
            // realData.userName = await getDefaultUserName();
            realData.userName = realData.firstName + " " + realData.lastName;
            let player = yield doSignUp(realData);
            yield (0, masterQueries_1.signupUser)(player);
            const result = JSON.parse(JSON.stringify(player));
            delete result.loginInfo;
            delete result.ivoreeId;
            delete result._id;
            delete result.info.address;
            delete result.info.createdAt;
            delete result.info.firstName;
            delete result.info.lastName;
            delete result.info.mobileNumber;
            let availableTable = yield (0, availableTableHelper_1.findAvailableOrCreateRoom)({ playerId: realData.playerID, client: data.client, isSinglePlayerTable: realData.multi_play ? false : true });
            return { success: true, playerInfo: result, isMultiPlayer: realData.multi_play, firstTimeUser: true, tableId: availableTable.response.tableId };
        }
    });
}
exports.onEntryRequest = onEntryRequest;
function doSignUp(data) {
    return __awaiter(this, void 0, void 0, function* () {
        let newPlayer = new player_1.Player(data, true);
        return newPlayer;
    });
}
function getDefaultUserName(tryCount = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        let userName = (0, unique_username_generator_1.generateUsername)(" ");
        // console.log(userName);
        if (tryCount > 5) {
            userName = (0, unique_username_generator_1.generateUsername)("-", 8);
        }
        let playerResult = yield (0, masterQueries_1.findUser)({ "info.name": userName }).catch((e) => {
        });
        if (!!playerResult) {
            userName = yield getDefaultUserName(tryCount + 1);
        }
        return userName;
    });
}
