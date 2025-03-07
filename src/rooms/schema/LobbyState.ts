import { Schema, Context, type } from "@colyseus/schema";

export class LobbyState extends Schema {

  @type("string") mySynchronizedProperty: string = "Hello world";

}
