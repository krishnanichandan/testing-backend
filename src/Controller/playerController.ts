
import * as playerService from '../Service/playerService'
import { Player } from '../dataFormats/player';


export const getPlayerTusks = async (req: any, res: any) => {
    const playerId = req.params.playerId as string;

    try {
        const player: Player = await playerService.getPlayerTuskBalance(playerId);
        res.send(player)
    } catch (e: any) {
        res.status(e.status).send(e.stack)
    }
}




