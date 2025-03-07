import { filter, where } from "underscore";

import { PlayerState } from "../types";
import { Table } from "../../../dataFormats/table";

export function getPlayersByState(table: Table, state: PlayerState) {
    return where(table.currentInfo.players, { state: state });
}

export function totalActivePlayers(input: any) {
    let players = filter(input.table.currentInfo.players, function (p) {
        return ((p.state == PlayerState.Playing || p.state == PlayerState.Disconnected) && p.active == true && p.initialBet > 0);
    });
    return ({ success: true, players: players });
}

export function totalActiveBettingPlayers(input: any) {
    let players = filter(input.table.currentInfo.players, function (p) {
        return ((p.state == PlayerState.Betting || p.state == PlayerState.Disconnected) && p.active == true);
    });
    return ({ success: true, players: players });
}

export function popCard(table: Table, count: number) {
    let cards = table.currentInfo.deck.slice(0, count);
    table.currentInfo.deck.splice(0, count);
    return ({ success: true, cards: cards });
};