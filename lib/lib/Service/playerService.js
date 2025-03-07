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
exports.getPlayerTuskBalance = void 0;
const error_1 = require("../errors/error");
const Queries_1 = require("../db/Queries");
const masterQueries_1 = require("../db/masterQueries");
const getPlayerTuskBalance = (playerId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const errors = [];
        if (!playerId) {
            errors.push('playerId is Required.');
        }
        else {
            const player = yield (0, masterQueries_1.findUser)({ playerId });
            if (player) {
                delete player._id;
                const playerData = {
                    playerId: player.playerId,
                    info: {
                        name: player.info.name,
                        firstName: player.info.firstName,
                        lastName: player.info.lastName,
                    },
                    accountInfo: {
                        tuskBalance: player.accountInfo.realChips,
                    }
                };
                const playerJoinRecord = yield (0, Queries_1.findPlayerOnAlreadyTableJoinRecord)({ playerId });
                if (!!playerJoinRecord) {
                    let query = {
                        id: playerJoinRecord.tableId,
                        'currentInfo.players': {
                            $elemMatch: {
                                playerId: playerJoinRecord.playerId
                            }
                        }
                    };
                    // Specify the projection to retrieve only the player details
                    let project = {
                        'currentInfo.players.$': 1, // Include only the matched player in the result
                        _id: 0 // Exclude the default _id field from the result
                    };
                    const table = yield (0, Queries_1.findInGamePlayerData)(query, project);
                    const inGamePlayer = !!table ? table.currentInfo.players.filter((player) => player.playerId === playerId) : null;
                    playerData.accountInfo.tuskBalance += !!inGamePlayer && inGamePlayer.length ? inGamePlayer[0].onGameStartBuyIn : 0;
                }
                return playerData;
            }
            else {
                errors.push('Player Not Found.');
            }
        }
        if (errors.length > 0) {
            throw new error_1.ValidationError(errors.join('\n'));
        }
    }
    catch (e) {
        throw new error_1.InternalServerError(e);
    }
});
exports.getPlayerTuskBalance = getPlayerTuskBalance;
