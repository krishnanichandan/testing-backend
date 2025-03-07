import { InGamePlayer } from "../../dataFormats/InGamePlayer";
import { PlayerMove } from "./gameConstants";
import { PlayerState } from "./types";
import { Table } from "../../dataFormats/table";

export function findTurnForPlayers(table: Table, playedPosition?: string, isDealerMove: boolean = false) {
    let currentMoveIndex = table.currentInfo.currentMoveIndex;
    let currentPlayingPosition = playedPosition || 'right';
    // console.log("allPlayers array :: ",table.currentInfo.players)
    let players = table.currentInfo.players.filter((player) => ((player.state === PlayerState.Playing || player.state === PlayerState.Disconnected) && player.active === true && player.initialBet > 0  ));
    // console.log('players in findTurnForPlayers :: ',players )
    if (isDealerMove) {
        return { success: true, isDealerMove, players }
    } else {
        while (currentMoveIndex !== -1 && !isDealerMove) {
            let player: InGamePlayer = players[currentMoveIndex];
            let nextPlayingPosition = '';
            let nextMoveIndex = 0;
            let leftHand = player?.handInfo?.left;
            let rightHand = player?.handInfo?.right;
            const hasSplit = player?.history?.some((x: { type: PlayerMove; }) => x.type === PlayerMove.Split) || false;


            if (hasSplit) {
                switch (currentPlayingPosition) {
                    case 'left': {
                        
                        nextPlayingPosition = leftHand.close ? 'right' : 'left';
                        nextMoveIndex = leftHand.close ? (currentMoveIndex + 1 > players.length - 1 ? -1 : currentMoveIndex + 1) : currentMoveIndex;
                        break;
                    }
                    case 'right': {
                        if (rightHand.close) {
                            nextPlayingPosition = leftHand.close ? 'right' : 'left';
                            nextMoveIndex = leftHand.close ? (currentMoveIndex + 1 > players.length - 1 ? -1 : currentMoveIndex + 1) : currentMoveIndex;
                        } else {
                            nextPlayingPosition = 'right';
                            nextMoveIndex = currentMoveIndex;
                        }
                        break;
                    }
                }
            } else {
                nextPlayingPosition = 'right';
                // nextMoveIndex = rightHand.close ? (currentMoveIndex + 1 > players.length - 1 ? -1 : currentMoveIndex + 1) : currentMoveIndex;
                nextMoveIndex = rightHand?((rightHand.close) ? (currentMoveIndex + 1 > players.length - 1 ? -1 : currentMoveIndex + 1) : currentMoveIndex):-1;
            }

            if (nextPlayingPosition === currentPlayingPosition && nextMoveIndex === currentMoveIndex) {
                break;
            }

            currentPlayingPosition = nextPlayingPosition;
            currentMoveIndex = nextMoveIndex;

            if (currentMoveIndex === -1) {
                isDealerMove = true;
            }
        }


    }

    return { success: true, isDealerMove: isDealerMove, players: players, currentMoveIndex: currentMoveIndex, currentPlayingPosition: currentPlayingPosition }

}