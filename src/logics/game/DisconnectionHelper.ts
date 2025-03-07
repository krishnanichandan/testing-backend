import * as LockerHelper from './LockTable/LockerHelper';

import { GameState, PlayerState } from "./types";
import { LeavePayload, leavePlayer } from "./leaveHelper";
import { Room, matchMaker } from "colyseus";
import { fetchTable, findSpectatorPlayerOnTableJoinRecord, forceUnlockTable, replaceTable } from "../../db/Queries";

import { Table } from "../../dataFormats/table";
import { dispatchPlayerStateBroadcast } from "./broadcaster";

async function getTableDataFromDb(tableId: string) {
    let table = await LockerHelper.getTable(tableId, "SetStateDisconnect").catch(e => { });

    if (!table) {
        return { success: false, info: "Table not found for this id" };
    }
    return { success: true, table: table };
};

async function replaceTableToDb(table: Table) {
    let modTable = await replaceTable(table).catch(e => { console.log(e) });
    if (!modTable) {
        return { success: false, info: "table couldnt be updated after add chips logic" };
    }
    return { success: true };
}

export async function updatePlayerStateOnDisconnect(playerId: string, tableId: string, room: Room) {
    console.log('updatePlayerStateOnDisconnect started', { playerId: playerId, tableId: tableId });
    let res = await getTableDataFromDb(tableId);
    if (!res.success) {
        return res;
    }
    let table = res.table;
    let playerIndexOnTable = table.currentInfo.players.findIndex((player) => player.playerId === playerId);
    if (playerIndexOnTable < 0) {
        await forceUnlockTable(tableId);
        console.log("updatePlayerStateOnDisconnect -> Player is not sitting.");
        return ({ success: false, info: "Player is not sitting." });
    } else {
       
        if (table.currentInfo.state === GameState.Betting) {
            if (table.currentInfo.players[playerIndexOnTable].state === PlayerState.Waiting) {
                table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                table.currentInfo.players[playerIndexOnTable].state = PlayerState.Disconnected;
            }

            if (table.currentInfo.players[playerIndexOnTable].state === PlayerState.Betting) {
                table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                table.currentInfo.players[playerIndexOnTable].state = PlayerState.Disconnected;
            }

            if (table.currentInfo.players[playerIndexOnTable].state === PlayerState.Ready) {
                table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                table.currentInfo.players[playerIndexOnTable].state = PlayerState.Disconnected;
            }

        }

        else if (table.currentInfo.state === GameState.Running) {
            if (table.currentInfo.players[playerIndexOnTable].state === PlayerState.Waiting) {
                table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                table.currentInfo.players[playerIndexOnTable].state = PlayerState.Disconnected;
                // SchedulerHelper.Instance.removeSitoutPlayer(tableId, playerId);
            }
            if (table.currentInfo.players[playerIndexOnTable].state === PlayerState.Playing) {
                table.currentInfo.players[playerIndexOnTable].previousState = table.currentInfo.players[playerIndexOnTable].state;
                table.currentInfo.players[playerIndexOnTable].state = PlayerState.Disconnected;
            }
        }

        let res2 = await replaceTableToDb(table);
        if (res2.success) {
        } else {
            console.log(res2);
        }

        console.log('Dispatched player state after Disconnection broadcast', { tableId: tableId, playerId: playerId, tableState: table.currentInfo.state, state: table.currentInfo.players[playerIndexOnTable].state, previousState: table.currentInfo.players[playerIndexOnTable].previousState });
        dispatchPlayerStateBroadcast(room, { tableId: tableId, playerId: playerId, playerState: table.currentInfo.players[playerIndexOnTable].state });
    }
}


export async function removePlayerSpectatorPlayer(playerId: string) {
    console.log('remove Spectator player if App is Killed started', { playerId: playerId });
    let playerJoinedTable = await findSpectatorPlayerOnTableJoinRecord({playerId: playerId, isSpectator: true });
    if (playerJoinedTable && playerJoinedTable.length) {
        playerJoinedTable.forEach((playerTable) => {
            let room = matchMaker.getRoomById(playerTable.tableId);
            const payload: LeavePayload = {
                tableId: playerTable.tableId,
                playerId: playerTable.playerId,
                isStandUp: false,
                isRequested: false,
                room: room,
                playerName: playerTable.playerName
            }

            setTimeout(() => {
                let res = leavePlayer(payload);
            }, 200);
        })
    }
}

export async function updatePlayerStateOnReconnect(playerId: string, tableId: string, room: Room) {
}