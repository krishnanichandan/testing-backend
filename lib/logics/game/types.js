"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerState = exports.GameState = exports.EndingType = void 0;
var EndingType;
(function (EndingType) {
    EndingType["GameComplete"] = "GameComplete";
    EndingType["EverybodyPacked"] = "EverybodyPacked";
    EndingType["OnlyOnePlayerLeft"] = "OnlyOnePlayerLeft";
})(EndingType || (exports.EndingType = EndingType = {}));
var GameState;
(function (GameState) {
    GameState["Idle"] = "Idle";
    GameState["Starting"] = "Starting";
    GameState["Waiting"] = "Waiting";
    GameState["Betting"] = "Betting";
    GameState["Running"] = "Running";
    GameState["Over"] = "Over";
})(GameState || (exports.GameState = GameState = {}));
var PlayerState;
(function (PlayerState) {
    PlayerState["Waiting"] = "Waiting";
    PlayerState["Starting"] = "Starting";
    PlayerState["Betting"] = "Betting";
    PlayerState["Playing"] = "Playing";
    PlayerState["Ready"] = "Ready";
    PlayerState["OutOfMoney"] = "OutOfMoney";
    PlayerState["OnBreak"] = "OnBreak";
    PlayerState["Disconnected"] = "Disconnected";
    PlayerState["onLeave"] = "onLeave";
    PlayerState["Reserved"] = "Reserved";
})(PlayerState || (exports.PlayerState = PlayerState = {}));
