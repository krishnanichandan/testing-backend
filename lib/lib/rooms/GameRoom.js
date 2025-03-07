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
exports.GameRoom = void 0;
const core_1 = require("@colyseus/core");
const GameSessionHelper_1 = require("../logics/game/GameSessionHelper");
const DisconnectionHelper_1 = require("../logics/game/DisconnectionHelper");
const GameRoomState_1 = require("./schema/GameRoomState");
const leaveHelper_1 = require("../logics/game/leaveHelper");
const AddChipsHelper_1 = require("../logics/game/AddChipsHelper");
const PlayerDealHelper_1 = require("../logics/game/PlayerDealHelper");
const PlayerInsuranceHelper_1 = require("../logics/game/PlayerInsuranceHelper");
const joinHelper_1 = require("../logics/game/joinHelper");
const moveHelper_1 = require("../logics/game/moveHelper");
const sitHelper_1 = require("../logics/game/sitHelper");
const SurrenderHelper_1 = require("../logics/game/SurrenderHelper");
const CommonGameUpdate_1 = require("../logics/game/CommonGameUpdate");
// GameRoom class handles all the server-side logic for a game room.
class GameRoom extends core_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 3; // Maximum number of players allowed in the room.
    }
    // Called when the room is created, initializes the room state and other setup.
    onCreate(options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.setState(new GameRoomState_1.GameRoomState());
            this.setMetadata({ gameStartEventSet: "IDLE" });
            this.autoDispose = false; // Prevent room from automatically disposing.
            let tableId = options.tableId;
            this.roomId = tableId;
            this.registerMessages(); // Register all the message handlers.
            // Initialize timer references for various game stages.
            this.timerRefs = {
                turnTimeReference: null,
                extraTurnTimeReference: null,
                timeBankTurnTimeReference: null,
                performAutoStand: null,
                bettingTimeRefernce: null,
                insuranceTimeRefernce: null,
            };
        });
    }
    // Called when a client joins the room, handles initial synchronization with the client.
    onJoin(client, options) {
        return __awaiter(this, void 0, void 0, function* () {
            client.userData = { playerId: options.playerId };
            console.log(client.sessionId, "Game room joined!");
            let obj = {
                tableId: this.roomId,
                playerId: client.userData.playerId,
            };
            let resp = yield (0, joinHelper_1.processJoin)(obj);
            console.log("Response of sync", JSON.stringify(resp));
            client.send("Sync", resp);
        });
    }
    // Handles player leaving the game room
    onLeave(client, consented) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(client.sessionId, "game room left!");
            // Update the player's state when they disconnect from the room
            yield (0, DisconnectionHelper_1.updatePlayerStateOnDisconnect)(client.userData.playerId, this.roomId, this);
            // Remove the player from the spectator list if they were a spectator
            yield (0, DisconnectionHelper_1.removePlayerSpectatorPlayer)(client.userData.playerId);
        });
    }
    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }
    registerMessages() {
        this.onMessage("sitHere", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            console.log("sithere->", payload.message);
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, sitHelper_1.processSit)(payload.message);
            console.log("res->", res);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'continueGame' message, used to continue a paused game session
        this.onMessage("continueGame", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, GameSessionHelper_1.continueGameSession)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'continueBet' message, used when a player continues with a bet action
        this.onMessage("continueBet", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, GameSessionHelper_1.continueBetPhase)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'playerDeal' message, used when a player is dealt cards or makes a move
        this.onMessage("playerDeal", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, PlayerDealHelper_1.processDealMove)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'makeMove' message, used when a player makes a move
        this.onMessage("makeMove", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            console.log("gameroom--makeMoveCalled---");
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, moveHelper_1.processMove)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'addChips' message, used when a player adds chips to their account
        this.onMessage("addChips", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, AddChipsHelper_1.processAddChips)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        this.onMessage("leave", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = yield (0, leaveHelper_1.leavePlayer)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'surrender' message, used when a player surrenders
        this.onMessage("surrender", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            //manage surrender 
            let res = yield (0, SurrenderHelper_1.processSurrenderMove)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'placeInsurance' message, used when a player places an insurance bet
        this.onMessage("placeInsurance", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            //manage insurance too
            let res = yield (0, PlayerInsuranceHelper_1.processInsuranceMove)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
        // Handler for the 'updateTableSettings' message, used to update the table settings
        this.onMessage("updateTableSettings", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            payload.message.room = this;
            payload.message.client = client;
            //manage table settings too
            let res = yield (0, CommonGameUpdate_1.updateTableSettings)(payload.message);
            client.send("response", { response: res, respId: payload.respId });
        }));
    }
}
exports.GameRoom = GameRoom;
