import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { Table } from "../../dataFormats/table";

export async function awardWinningChips(input: any) {
    let table: Table = input.table;
    input.data.playersResult.forEach((result: any) => {
        let playerIndex = table.currentInfo.players.findIndex((player) => player.playerId === result.playerId);
        //.info, 'Winner index in table players - ' + playerIndex);
        if (playerIndex >= 0) {
            table.currentInfo.players[playerIndex].chips += result.winningAmount;
            table.currentInfo.players[playerIndex].chips += result.insuranceData.winningAmount;

        } else {
            //.error, 'Winner player left, unable to add on-table chips!');
        }

    });


    //now assigning amount here only rather than in next function call, also why not doing this before in above loop
    input.data.playersResult.forEach((result: any) => {

        let playerIndex = input.table.currentInfo.players.findIndex((player: InGamePlayer) => player.playerId == result.playerId);
        if (playerIndex >= 0) {
            result.chips = input.table.currentInfo.players[playerIndex].chips;
        } else {
            //info, 'Player not present on table, not adding chips for client response!');
        }
    });
};