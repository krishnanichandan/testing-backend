import { Client, Room } from "colyseus";

import { IncomingMessage } from "http";
import { LobbyState } from "./schema/LobbyState";
import { decryptData } from "../logics/game/test";
import { findAvailableOrCreateRoom } from "../logics/game/availableTableHelper";
import { onEntryRequest } from "../logics/game/entryHelper";
import { processJoin } from "../logics/game/joinHelper";

export class LobbyRoom extends Room<LobbyState> {

    // Called when the room is created, initializes the room state and other setup.
    onCreate(options: any) {
        this.setState(new LobbyState());
        this.registerClientMessages();
        this.autoDispose = false;
    }
// Called when a client joins the room, handles initial synchronization with the client.
    registerClientMessages() {
// Register message handlers for the client.
        this.onMessage("entry", async (client, payload) => {
            console.log("entry called")
            payload.message.client = client;
            let loginResponse = await onEntryRequest(payload.message);
            console.log("entry response->", loginResponse);
            client.send("response", { response: loginResponse, respId: payload.respId });
        });
    }
// Called when a client joins the room, handles initial synchronization with the client.
    onAuth(client: Client, options: any, request?: IncomingMessage) {
        return true;//auth??
    }

    onJoin(client: Client, options: any) {
        client.userData = { playerId: options.playerId };//assuming here Ivoree Data will come
        
        const encryptedDataFromIvoree = 'UC106ipJjDkztZkhDQPL6q7C0RUkqcltenRKPcmeofiFJT8t/rrINxIt+RFqWNZJizqUXZ8krDYys7V8QQUhr5B67yMmcuelb/+iiVnqw4nIVCzEhdfzOBRbxKY9L8TjuLHe7oyyT5VJZMuyR+VLFdD7dTcitb1pe9lOXm98bLcgWkCjKgGNsBQGTrmpd2vT9JAR43eBdRJVgX8vY0c/NOM9QTy3uT6nd16YjbMBdnex04R54JUHNhXjYtvVciauPyxHh95vCK5+2ctTslha2NW2+44oK+lM/uMfI6+E3GiciQsSeIa6GD0PTJFJdCx5snvD+CK7OUISV4pQmWOs4lTvy1VcNyDx2bcFJOFk2hTrYKIgqtDPVZkqYc9BkX+eIQ3zE3XoPuUEHl+1DhOKOL6fPZ9yuhP7987AGf7bOEuLLMsMDnQGK18y9egUgkAylDL92Fpbsrvyba9keyl0CW2J/OsmQFrVk0c/B9EQNUCrSJCh2acZ8LAGPVcwofWzij/gDsIMoJMa0kHV/x7QO3pfMUrODAmjIp483MXAlvUiU9ewsVPe5wXphIiVBFAb';
        console.log(client.sessionId, "joined lobby!");
    }

    
}