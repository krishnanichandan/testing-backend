import {
    ForbiddenError,
    InternalServerError,
    RecordNotFoundError,
    ValidationError
} from '../errors/error'
import { findInGamePlayerData, findPlayerOnAlreadyTableJoinRecord } from '../db/Queries';

import { InGamePlayer } from '../dataFormats/InGamePlayer';
import { Table } from '../dataFormats/table';
import { findUser } from '../db/masterQueries';

export const getPlayerTuskBalance = async (playerId: string): Promise<any> => {
    try {
        const errors: string[] = [];

        if (!playerId) {
            errors.push('playerId is Required.');
        } else {
            const player = await findUser({ playerId });
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
                }
                const playerJoinRecord = await findPlayerOnAlreadyTableJoinRecord({ playerId })
                if (!!playerJoinRecord) {
                    let query = {
                        id: playerJoinRecord.tableId,
                        'currentInfo.players': {
                            $elemMatch: {
                                playerId: playerJoinRecord.playerId
                            }
                        }
                    }
                    // Specify the projection to retrieve only the player details
                    let project = {
                        'currentInfo.players.$': 1, // Include only the matched player in the result
                        _id: 0 // Exclude the default _id field from the result
                    };
                    const table: Table = await findInGamePlayerData(query, project);
                    const inGamePlayer: InGamePlayer[] = !!table ? table.currentInfo.players.filter((player) => player.playerId === playerId) : null
                    playerData.accountInfo.tuskBalance += !!inGamePlayer && inGamePlayer.length ? inGamePlayer[0].onGameStartBuyIn : 0
                }

                return playerData;
            } else {
                errors.push('Player Not Found.');
            }
        }

        if (errors.length > 0) {
            throw new ValidationError(errors.join('\n'));
        }

    } catch (e) {
        throw new InternalServerError(e)
    }
}







