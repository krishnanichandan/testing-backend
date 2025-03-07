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
exports.DbManager = void 0;
const mongodb_1 = require("mongodb");
// systemConfig
// let staging_uri = "mongodb+srv://shishir:2swkidw2lQFnfPZH@24-7play.thiowq7.mongodb.net/test";
let staging_uri = "mongodb+srv://wiet_game_user1:DqkbKPyDuw5exv21M0vTVyikhQOY9KI7@cluster0.cmteskc.mongodb.net/";
let prod_uri = "";
let uri = (process.env.NODE_ENV == "production") ? prod_uri : staging_uri;
/*collection todo
userSession collection
admin
finance
log
*/
//if you write code using the raw compiled javascript you will not have protection against multiple instantiation, as the constraints of TS disappears and the constructor won't be hidden.
class DbManager {
    constructor() {
        console.log("constructor of DbManager");
        this.client = new mongodb_1.MongoClient(uri);
    }
    static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Connect the client to the server (optional starting in v4.7)
                yield this.client.connect();
                // Establish and verify connection
                this.masterDb = yield this.client.db("gamesbj");
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
        });
    }
}
exports.DbManager = DbManager;
