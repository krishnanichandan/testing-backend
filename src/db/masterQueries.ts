import { DbManager } from "./DbManager";
import { Player } from "../dataFormats/player";

//#region Entry

export async function signupUser(playerData: Player): Promise<void> {
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.insertOne(playerData);
}


//#endregion

//used for preferences and from updateprofilehelper.ts // also stats when leave table
export async function updateUser(filterObj: any, updateKeys: any) {
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.updateOne(filterObj, { $set: updateKeys }, { upsert: true })
    return result;
};

export async function findUser(filterObj: any): Promise<Player> {
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.findOne<Player>(filterObj);
    return result;
};

export async function findAndUpdateUser(filterObj: any,updateObj:any): Promise<Player> {
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.findOneAndUpdate(filterObj,{$set:updateObj},{returnDocument:"after"});
    return result.value;
};


//#region ChipsUpdater queries

export async function deductRealChips(filter: any, chips: number, instantBonusAmount: number = 0) {
   
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.realChips": -chips, "accountInfo.instantBonusAmount": -instantBonusAmount } }, { returnDocument: "after" });
    return result.value;
};

export async function deductFreeChips(filter: any, chips: number) {
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.playChips": -chips } }, { returnDocument: "after" });
    return result.value;
};

export async function addRealChips(filter: any, chips: number) {
    let instantIBA = 0;
    if (filter.instantBonusAmount >= 0) {
        instantIBA = filter.instantBonusAmount;
        delete filter.instantBonusAmount;
    }
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.realChips": chips, "accountInfo.instantBonusAmount": instantIBA } }, { returnDocument: "after" });
    return result.value;
}

export async function addFreeChips(filter: any, chips: number) {
    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");
    const result = await usersCollection.findOneAndUpdate(filter, { $inc: { "accountInfo.playChips": chips } }, { returnDocument: "after" });
    return result.value;
}


export async function increaseUserStats(query: { playerIds: string[], playerId?: string }, updateKeys: any) {
    // prepare a query for one or more players
    function getPlayerIdsQuery(obj: { playerIds: any[], playerId?: string }) {
        if (obj.playerIds instanceof Array) {
            if (obj.playerIds.length <= 0) {
                return false;
            }
            return { playerId: { $in: obj.playerIds } };
        }
        if (!obj.playerId) {
            return false;
        }
        return { playerId: obj.playerId };
    }


    const usersCollection = DbManager.Instance.masterDb.collection<Player>("players");

    let usableQuery = getPlayerIdsQuery(query);
    if (!usableQuery) {
        console.log("query not valid")
        return;
    }
    const result = await usersCollection.updateMany(usableQuery, { $inc: updateKeys });
    return result;
};



