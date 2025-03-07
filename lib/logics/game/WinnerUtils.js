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
exports.awardWinningChips = void 0;
function awardWinningChips(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let table = input.table;
        input.data.playersResult.forEach((result) => {
            let playerIndex = table.currentInfo.players.findIndex((player) => player.playerId === result.playerId);
            //.info, 'Winner index in table players - ' + playerIndex);
            if (playerIndex >= 0) {
                table.currentInfo.players[playerIndex].chips += result.winningAmount;
                table.currentInfo.players[playerIndex].chips += result.insuranceData.winningAmount;
            }
            else {
                //.error, 'Winner player left, unable to add on-table chips!');
            }
        });
        //now assigning amount here only rather than in next function call, also why not doing this before in above loop
        input.data.playersResult.forEach((result) => {
            let playerIndex = input.table.currentInfo.players.findIndex((player) => player.playerId == result.playerId);
            if (playerIndex >= 0) {
                result.chips = input.table.currentInfo.players[playerIndex].chips;
            }
            else {
                //info, 'Player not present on table, not adding chips for client response!');
            }
        });
    });
}
exports.awardWinningChips = awardWinningChips;
;
