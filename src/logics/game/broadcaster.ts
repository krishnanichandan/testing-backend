import { Dealer, Table } from "../../dataFormats/table";
import { map, pick } from "underscore";

import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { Room } from "colyseus";
import { gameStartBroadcastData } from "../../dataFormats/ClientDataFormat.ts/ResponseMaker";

type TablePlayers = {
    tableId: string;
    players: InGamePlayer[];
    removed?: InGamePlayer[];
    spectator?: any[]
}

type DistributeCards = {
    tableId: string;
    players: InGamePlayer[];//to distribute
    numCards: number;
    dealer:Dealer
}


export function dispatchOnTurnBroadcast(room: Room, data: any) {
    let dataToSend = {
        isGameOver: data.isGameOver,
        turn: data.turn
    }

    console.log("****OnTurnBroadCast***->", JSON.stringify(dataToSend))
    room.broadcast("OnTurn", dataToSend);
}

export function dispatchPlayerSitBroadcast(room: Room, player: InGamePlayer) {
    let data: any = {
        tableId: player.tableId, playerId: player.playerId, chips: player.chips, seatIndex: player.seatIndex, playerName: player.playerName, avatar: player.avatar, state: player.state,

        statistics: player.stats
    };
    console.log("sit broadcast->", data)
    room?.broadcast("PlayerSit", data);
}

export function dispatchTablePlayersBroadcast(room: Room, data: TablePlayers) {
    //todos slice player data in everybroadcast and able data etc.
    room.broadcast("TablePlayers", data);
}

export function dispatchPlayerStateBroadcast(room: Room, data: any) {
    room.broadcast("PlayerState", data);
}

export function dispatchDistributeCardsBroadcast(room: Room, data: DistributeCards) {
    let ts = JSON.parse(JSON.stringify(map(data.players, function (player: any) { return pick(player, 'playerId', 'playerName', 'chips', 'state', "seatIndex", "handInfo", "history"); })));
    room.broadcast("DistributeCards", { tableId: data.tableId, players: ts, numCards: data.numCards ,dealer:data.dealer});
}

// ### Broadcast start game on table ALSO start a video json record
// > Inform client to start a game on table and provide details
// > Get current config for table
// > channelId, currentPlayerId, smallBlindId, bigBlindId, dealerId, straddleId, bigBlind, smallBlind, pot, roundMaxBet, state, playerCards
export function dispatchStartGameBroadcast(room: Room, table: Table) {
    var tdata: any = gameStartBroadcastData(table);
    tdata.config.currentMoveIndex = undefined;
   
    room.broadcast("StartGame", tdata);
    return tdata;

};

export function dispatchPlayerChipsBroadCast(room: Room, data: any) {
    room.broadcast("PlayerGameChips", data);
}


export function dispatchPlayerDealBroadCast(room: Room, data: any) {
    room.broadcast("PlayerDeal", data);
};

export function dispatchLeaveBroadcast(room: Room, data: any) {
    console.log("leave BroadCast->", JSON.stringify(data));
    room.broadcast("OnPlayerLeft", data);
};

export function dispatchInsuranceBroadCasts(room: Room, data: any) {
    room.broadcast("StartInsurance", data);
};

export function dispatchStartBettingBroadCasts(room: Room, data: any) {
    const bettingPlayers: { seatIndex: any; initialBet: any; turnTime: any; playerId: any; tableId: any; playerName: any; active: any; chips: any; avatar: any; state: any; isWaitingPlayer: any; }[] = [];
    data.bettingPlayers.forEach((player: any) => {
        const data = {
            seatIndex: player.seatIndex,
            initialBet: player.initialBet,
            turnTime: player.turnTime,
            playerId: player.playerId,
            tableId: player.tableId,
            playerName: player.playerName,
            active: player.active,
            chips: player.chips,
            avatar: player.avatar,
            state: player.state,
            isWaitingPlayer: player.isWaitingPlayer,

        }
        bettingPlayers.push(data)
    });
    data.bettingPlayers = bettingPlayers
    room.broadcast("StartBettingPhase", data)
};

export function dispatchPlayerInsuranceBroadCasts(room: Room, data: any) {
    room.broadcast("playerInsurance", data)
};

export function dispatchDealerHoldcardBroadCasts(room: Room, data: any) {
    room.broadcast("dealerHoldCardOpen", data)
};



export function dispatchGameOverBroadcast(room: Room, data: any) {
    console.log("**OnGameOver Broadcast->",JSON.stringify(data))
    room.broadcast("OnGameOver", data)
};

export function dispatchPlayerSurrenderBroadcast(room: Room, data: any) {
    room.broadcast("OnPlayerSurrender", data)
}

export function dispatchPlayerPlaySessionBroadCast(room: Room, data: any) {
    room.broadcast("OnPlayerSessionOver", data)
}

export function dispatchPlayerBetContinuePhaseBroadcast(room: Room, data: any) {
    room.broadcast("OnPlayerContinueBetPhase", data)
}
