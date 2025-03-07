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
exports.LobbyRoom = void 0;
const colyseus_1 = require("colyseus");
const LobbyState_1 = require("./schema/LobbyState");
const entryHelper_1 = require("../logics/game/entryHelper");
class LobbyRoom extends colyseus_1.Room {
    // Called when the room is created, initializes the room state and other setup.
    onCreate(options) {
        this.setState(new LobbyState_1.LobbyState());
        this.registerClientMessages();
        this.autoDispose = false;
    }
    // Called when a client joins the room, handles initial synchronization with the client.
    registerClientMessages() {
        // Register message handlers for the client.
        this.onMessage("entry", (client, payload) => __awaiter(this, void 0, void 0, function* () {
            console.log("entry called");
            payload.message.client = client;
            let loginResponse = yield (0, entryHelper_1.onEntryRequest)(payload.message);
            console.log("entry response->", loginResponse);
            client.send("response", { response: loginResponse, respId: payload.respId });
        }));
    }
    // Called when a client joins the room, handles initial synchronization with the client.
    onAuth(client, options, request) {
        return true; //auth??
    }
    onJoin(client, options) {
        client.userData = { playerId: options.playerId }; //assuming here Ivoree Data will come
        const encryptedDataFromIvoree = 'UC106ipJjDkztZkhDQPL6q7C0RUkqcltenRKPcmeofiFJT8t/rrINxIt+RFqWNZJizqUXZ8krDYys7V8QQUhr5B67yMmcuelb/+iiVnqw4nIVCzEhdfzOBRbxKY9L8TjuLHe7oyyT5VJZMuyR+VLFdD7dTcitb1pe9lOXm98bLcgWkCjKgGNsBQGTrmpd2vT9JAR43eBdRJVgX8vY0c/NOM9QTy3uT6nd16YjbMBdnex04R54JUHNhXjYtvVciauPyxHh95vCK5+2ctTslha2NW2+44oK+lM/uMfI6+E3GiciQsSeIa6GD0PTJFJdCx5snvD+CK7OUISV4pQmWOs4lTvy1VcNyDx2bcFJOFk2hTrYKIgqtDPVZkqYc9BkX+eIQ3zE3XoPuUEHl+1DhOKOL6fPZ9yuhP7987AGf7bOEuLLMsMDnQGK18y9egUgkAylDL92Fpbsrvyba9keyl0CW2J/OsmQFrVk0c/B9EQNUCrSJCh2acZ8LAGPVcwofWzij/gDsIMoJMa0kHV/x7QO3pfMUrODAmjIp483MXAlvUiU9ewsVPe5wXphIiVBFAb';
        console.log(client.sessionId, "joined lobby!");
    }
}
exports.LobbyRoom = LobbyRoom;
