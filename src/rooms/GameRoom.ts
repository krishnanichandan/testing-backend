import { Client, Room } from "@colyseus/core";
import { continueBetPhase, continueGameSession } from "../logics/game/GameSessionHelper";
import { removePlayerSpectatorPlayer, updatePlayerStateOnDisconnect } from "../logics/game/DisconnectionHelper";

import { Delayed } from "colyseus";
import { GameRoomState } from "./schema/GameRoomState";
import { leavePlayer } from "../logics/game/leaveHelper";
import { processAddChips } from "../logics/game/AddChipsHelper";
import { processDealMove } from "../logics/game/PlayerDealHelper";
import { processInsuranceMove } from "../logics/game/PlayerInsuranceHelper";
import { processJoin } from "../logics/game/joinHelper";
import { processMove } from "../logics/game/moveHelper";
import { processSit } from "../logics/game/sitHelper";
import { processSurrenderMove } from "../logics/game/SurrenderHelper";
import { updateTableSettings } from "../logics/game/CommonGameUpdate";

// GameRoom class handles all the server-side logic for a game room.
export class GameRoom extends Room<GameRoomState> {
    maxClients = 3; // Maximum number of players allowed in the room.
    tableData: any; // Stores the table's data (e.g., game state, player details).
     // Timer references for various game phases.
    timerRefs: {
        turnTimeReference: Delayed,
        extraTurnTimeReference: Delayed,
        timeBankTurnTimeReference: Delayed,
        performAutoStand: Delayed,
        bettingTimeRefernce: Delayed,
        insuranceTimeRefernce: Delayed,

    };

// Called when the room is created, initializes the room state and other setup.
    async onCreate(options: any) {
        this.setState(new GameRoomState());
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
    }

// Called when a client joins the room, handles initial synchronization with the client.
    async onJoin(client: Client, options: any) {
        client.userData = { playerId: options.playerId };
        console.log(client.sessionId, "Game room joined!");
        let obj = {
            tableId: this.roomId,
            playerId: client.userData.playerId,
        }
        let resp = await processJoin(obj)
        console.log("Response of sync", JSON.stringify(resp))
        client.send("Sync", resp);
    }
// Handles player leaving the game room
    async onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "game room left!");
        // Update the player's state when they disconnect from the room
        await updatePlayerStateOnDisconnect(client.userData.playerId, this.roomId, this);
        // Remove the player from the spectator list if they were a spectator
        await removePlayerSpectatorPlayer(client.userData.playerId);
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

    registerMessages() {
        this.onMessage("sitHere", async (client, payload) => {
            console.log("sithere->", payload.message)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await processSit(payload.message);
            console.log("res->",res)

            client.send("response", { response: res, respId: payload.respId });
        });

// Handler for the 'continueGame' message, used to continue a paused game session
        this.onMessage("continueGame", async (client, payload) => {
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await continueGameSession(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });

// Handler for the 'continueBet' message, used when a player continues with a bet action
        this.onMessage("continueBet", async (client, payload) => {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await continueBetPhase(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });

// Handler for the 'playerDeal' message, used when a player is dealt cards or makes a move

        this.onMessage("playerDeal", async (client, payload) => {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await processDealMove(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
// Handler for the 'makeMove' message, used when a player makes a move
        this.onMessage("makeMove", async (client, payload) => {
            console.log("gameroom--makeMoveCalled---")
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await processMove(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
        // Handler for the 'addChips' message, used when a player adds chips to their account
        this.onMessage("addChips", async (client, payload) => {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await processAddChips(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
        this.onMessage("leave", async (client, payload) => {
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            let res = await leavePlayer(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
// Handler for the 'surrender' message, used when a player surrenders
        this.onMessage("surrender", async (client, payload) => {
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            //manage surrender 
            let res = await processSurrenderMove(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
// Handler for the 'placeInsurance' message, used when a player places an insurance bet
        this.onMessage("placeInsurance", async (client, payload) => {
            // logger.info("gameroom--sitHere---",client)
            payload.message.room = this;
            payload.message.client = client;
            // console.log("payload",payload.message.room.roomId)
            //manage insurance too
            let res = await processInsuranceMove(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
// Handler for the 'updateTableSettings' message, used to update the table settings
        this.onMessage("updateTableSettings", async (client, payload) => {

            payload.message.room = this;
            payload.message.client = client;
            //manage table settings too
            let res = await updateTableSettings(payload.message);

            client.send("response", { response: res, respId: payload.respId });
        });
    }
}
