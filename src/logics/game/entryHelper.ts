import { findAndUpdateUser, findUser, signupUser } from "../../db/masterQueries";

import { Client } from "colyseus";
import { Player } from "../../dataFormats/player";
import { decryptData } from "./test";
import { findAvailableOrCreateRoom } from "./availableTableHelper";
import { generateUsername } from "unique-username-generator";

type EntryPayload = {
    userName?: string;
    arbitraryId?: string;
    encodedData: string;
    client:Client
}

export async function onEntryRequest(data: EntryPayload) {

    
    console.log(data.encodedData)
    if (!data.encodedData) {
        return { success: false, info: "Incomplete request" }
    }
    const validJsonString = data.encodedData.replace(/([a-zA-Z0-9]+)\s*:/g, '"$1":');
    const jsonString = validJsonString.replace(/:([^,}\]]+)/g, ':"$1"');

    // Parse the valid JSON string into a JavaScript object
    const jsonObject = JSON.parse(jsonString);
    
    if (!jsonObject) {
        return { success: false, info: "Incomplete request" }
    }

    const decryptedEncodedData: any = await decryptData(jsonObject.data);
    const realData: any = JSON.parse(decryptedEncodedData);

    if (!realData.casinoTenentId) {
        return { success: false, info: "Incomplete request" }
    }
    //fetch player using arbitrary Id
    const filter = {
        playerId: realData.playerID
    }
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
    }
    let player: any = await findAndUpdateUser(filter, updateFeilds);
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
        let availableTable = await findAvailableOrCreateRoom({ playerId: realData.playerID, client: data.client, isSinglePlayerTable: realData.multi_play ? false : true });
        return { success: true, playerInfo: result, isMultiPlayer: realData.multi_play, firstTimeUser: false, tableId: availableTable.response.tableId };
    }
    else {
        // realData.userName = await getDefaultUserName();
        realData.userName = realData.firstName + " " + realData.lastName;
        let player: Player = await doSignUp(realData)
        await signupUser(player);
        const result = JSON.parse(JSON.stringify(player));
        delete result.loginInfo;
        delete result.ivoreeId;
        delete result._id;
        delete result.info.address;
        delete result.info.createdAt;
        delete result.info.firstName;
        delete result.info.lastName;
        delete result.info.mobileNumber;
        let availableTable = await findAvailableOrCreateRoom({ playerId: realData.playerID, client: data.client, isSinglePlayerTable: realData.multi_play ? false : true });
        return { success: true, playerInfo: result, isMultiPlayer: realData.multi_play, firstTimeUser: true, tableId: availableTable.response.tableId };
    }

}

async function doSignUp(data: EntryPayload) {
    let newPlayer = new Player(data, true);


    return newPlayer
}

async function getDefaultUserName(tryCount = 0): Promise<string> {
    let userName = generateUsername(" ");
    // console.log(userName);
    if (tryCount > 5) {
        userName = generateUsername("-", 8);
    }
    let playerResult: Player | void = await findUser({ "info.name": userName }).catch((e) => {
    });
    if (!!playerResult) {
        userName = await getDefaultUserName(tryCount + 1)
    }
    return userName;
}




