"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTurnForPlayers = void 0;
const gameConstants_1 = require("./gameConstants");
const types_1 = require("./types");
function findTurnForPlayers(table, playedPosition, isDealerMove = false) {
    var _a, _b, _c;
    let currentMoveIndex = table.currentInfo.currentMoveIndex;
    let currentPlayingPosition = playedPosition || 'right';
    // console.log("allPlayers array :: ",table.currentInfo.players)
    let players = table.currentInfo.players.filter((player) => ((player.state === types_1.PlayerState.Playing || player.state === types_1.PlayerState.Disconnected) && player.active === true && player.initialBet > 0));
    // console.log('players in findTurnForPlayers :: ',players )
    if (isDealerMove) {
        return { success: true, isDealerMove, players };
    }
    else {
        while (currentMoveIndex !== -1 && !isDealerMove) {
            let player = players[currentMoveIndex];
            let nextPlayingPosition = '';
            let nextMoveIndex = 0;
            let leftHand = (_a = player === null || player === void 0 ? void 0 : player.handInfo) === null || _a === void 0 ? void 0 : _a.left;
            let rightHand = (_b = player === null || player === void 0 ? void 0 : player.handInfo) === null || _b === void 0 ? void 0 : _b.right;
            const hasSplit = ((_c = player === null || player === void 0 ? void 0 : player.history) === null || _c === void 0 ? void 0 : _c.some((x) => x.type === gameConstants_1.PlayerMove.Split)) || false;
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
                        }
                        else {
                            nextPlayingPosition = 'right';
                            nextMoveIndex = currentMoveIndex;
                        }
                        break;
                    }
                }
            }
            else {
                nextPlayingPosition = 'right';
                // nextMoveIndex = rightHand.close ? (currentMoveIndex + 1 > players.length - 1 ? -1 : currentMoveIndex + 1) : currentMoveIndex;
                nextMoveIndex = rightHand ? ((rightHand.close) ? (currentMoveIndex + 1 > players.length - 1 ? -1 : currentMoveIndex + 1) : currentMoveIndex) : -1;
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
    return { success: true, isDealerMove: isDealerMove, players: players, currentMoveIndex: currentMoveIndex, currentPlayingPosition: currentPlayingPosition };
}
exports.findTurnForPlayers = findTurnForPlayers;
