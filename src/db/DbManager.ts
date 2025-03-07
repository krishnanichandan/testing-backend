import { MongoClient, Db } from "mongodb";
// systemConfig
// let staging_uri = "mongodb+srv://shishir:2swkidw2lQFnfPZH@24-7play.thiowq7.mongodb.net/test";
let staging_uri = "mongodb+srv://wiet_game_user1:DqkbKPyDuw5exv21M0vTVyikhQOY9KI7@cluster0.cmteskc.mongodb.net/"

let prod_uri = "";

let uri = (process.env.NODE_ENV == "production") ? prod_uri : staging_uri;

/*collection todo
userSession collection
admin
finance
log
*/

//if you write code using the raw compiled javascript you will not have protection against multiple instantiation, as the constraints of TS disappears and the constructor won't be hidden.
export class DbManager {
    private static _instance: DbManager;
    private client: MongoClient;
    masterDb: Db;
    constructor() {
        console.log("constructor of DbManager");
        this.client = new MongoClient(uri);
    }
    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public async init() {
        try {
            // Connect the client to the server (optional starting in v4.7)
            await this.client.connect();
            // Establish and verify connection
            this.masterDb = await this.client.db("gamesbj");
            console.log("Connected successfully to server ", new Date().toString());
        }
        catch (err) {
            // catchCode - Code block to handle errors
            console.log("db init error ", err);
        }
        finally {
            // Ensures that the client will close when you finish/error
            // await client.close();
            // console.log("db closed");
        }
    }

}
