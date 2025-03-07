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
exports.updateTableSettings = void 0;
const colyseus_1 = require("colyseus");
const Queries_1 = require("../../db/Queries");
const masterQueries_1 = require("../../db/masterQueries");
function updateTableSettings(data) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('updateTableSettings called', { tableId: data.tableId, playerId: data.playerId });
        let playerRecord = yield (0, Queries_1.findPlayerOnTableJoinRecord)({ tableId: data.tableId, playerId: data.playerId });
        if (!!playerRecord) {
            let tablePlayerSetting = playerRecord.settings;
            for (let val in data.updateKeys) {
                tablePlayerSetting[val] = data.updateKeys[val];
            }
            let profileUpdateData = {};
            for (let val in data.updateKeys) {
                profileUpdateData["preferences." + val] = data.updateKeys[val];
            }
            let query = {
                id: data.tableId,
                'currentInfo.players': {
                    $elemMatch: {
                        playerId: data.playerId
                    }
                }
            };
            let updateField = {
                $set: {
                    "currentInfo.players.$.settings": tablePlayerSetting
                }
            };
            const [res1, res3] = yield Promise.all([
                (0, Queries_1.updateTableJoinSettingsInDb)({ tableId: data.tableId, playerId: data.playerId, settings: tablePlayerSetting }),
                // updateTableSettingsInDb({ filter: query, updateObj: updateField }),
                (0, masterQueries_1.updateUser)({ playerId: data.playerId }, profileUpdateData)
            ]);
            const rooms = yield colyseus_1.matchMaker.query({ name: "game" });
            rooms.forEach((gameRoom) => {
                let room = colyseus_1.matchMaker.getRoomById(gameRoom.roomId);
                if (!!room) {
                    if (room.clients.filter((c) => c.userData.playerId === data.playerId).length > 0) {
                        room.broadcast("UpdatePlayerTableSetting", { playerId: data.playerId, muteGameSound: data.updateKeys.muteGameSound, muteGameMusic: data.updateKeys.muteGameMusic });
                    }
                }
            });
            if (res3.acknowledged && res3.modifiedCount) {
                let dataToSend = { muteGameSound: data.updateKeys.muteGameSound, muteGameMusic: data.updateKeys.muteGameMusic };
                data.client.send("Player_Settings_Update", { playerId: data.playerId, data: dataToSend });
            }
            return { success: true };
        }
        else {
            console.log('Failed to update table settings or profile', { tableId: data.tableId, playerId: data.playerId });
            return { success: false, info: "Couldn't complete the operation" };
        }
    });
}
exports.updateTableSettings = updateTableSettings;
