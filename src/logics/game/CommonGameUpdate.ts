import { matchMaker } from "colyseus";
import { findPlayerOnTableJoinRecord, updateTableJoinSettingsInDb, updateTableSettingsInDb } from "../../db/Queries";
import { updateUser } from "../../db/masterQueries";



export async function updateTableSettings(data: { tableId: string, playerId: string, updateKeys: any, client: any }) {
    console.log('updateTableSettings called', { tableId: data.tableId, playerId: data.playerId })
    let playerRecord = await findPlayerOnTableJoinRecord({ tableId: data.tableId, playerId: data.playerId });
    if (!!playerRecord) {
        let tablePlayerSetting = playerRecord.settings;
        for (let val in data.updateKeys) {
            tablePlayerSetting[val] = data.updateKeys[val]
        }

        let profileUpdateData: any = {}
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
        }
        let updateField = {
            $set: {
                "currentInfo.players.$.settings": tablePlayerSetting
            }
        }

        const [res1, res3] = await Promise.all([
            updateTableJoinSettingsInDb({ tableId: data.tableId, playerId: data.playerId, settings: tablePlayerSetting }),
            // updateTableSettingsInDb({ filter: query, updateObj: updateField }),
            updateUser({ playerId: data.playerId }, profileUpdateData)
        ]);

        const rooms = await matchMaker.query({ name: "game" });
        rooms.forEach((gameRoom) => {
            let room = matchMaker.getRoomById(gameRoom.roomId);
            if (!!room) {
                if (room.clients.filter((c) => c.userData.playerId === data.playerId).length > 0) {
                    room.broadcast("UpdatePlayerTableSetting", { playerId: data.playerId, muteGameSound: data.updateKeys.muteGameSound, muteGameMusic: data.updateKeys.muteGameMusic });
                }
            }
        });

        if (res3.acknowledged && res3.modifiedCount) {
            let dataToSend = { muteGameSound: data.updateKeys.muteGameSound, muteGameMusic: data.updateKeys.muteGameMusic }
            data.client.send("Player_Settings_Update", { playerId: data.playerId, data: dataToSend });
        }
        return { success: true }
    } else {
        console.log('Failed to update table settings or profile', { tableId: data.tableId, playerId: data.playerId })
        return { success: false, info: "Couldn't complete the operation" }
    }
}

