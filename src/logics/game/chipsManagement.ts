import { addFreeChips, addRealChips, deductFreeChips, deductRealChips, findUser } from "../../db/masterQueries";

import { Player } from "../../dataFormats/player";

type AddChipsPayload = {
    chips: number;
    instantBonusAmount: number;
    playerId: string;
    isRealMoney: boolean;
    tableName?: string;
    prevBalForPassbook?: number;
    tableId?: string;
    category?: string;
}

type DeductChipsPayload = {
    tableId?: string;
    subCategory?: string;
    chips: number;
    playerId: string;
    isRealMoney: boolean;
    tableName?: string;
}

export async function addChips(input: AddChipsPayload) {
    // logger.info("addChips--",input)
    // console.log("params are in addChips - " + JSON.stringify(params));
    input.tableId = !!input.tableId ? input.tableId : "";
    input.chips = Math.round(input.chips);
    if (input.instantBonusAmount > 0) {
        if (input.chips >= input.instantBonusAmount) {
            input.chips = Math.round(input.chips - input.instantBonusAmount);
            input.instantBonusAmount = Math.round(input.instantBonusAmount);
        } else {
            input.instantBonusAmount = Math.round(input.chips);
            input.chips = 0;
        }
    }

    let findUserError: any = null;
    //integrateDb later
    let player: Player | void = await findUser({ playerId: input.playerId }).catch((e) => {
        findUserError = e;
    });
    if (!!findUserError) {
        findUserError.errorData = { success: false, info: "Unable to add chips, user not found. Player id" };
        return findUserError;
    }
    if (!!player) {
        if (input.isRealMoney) {
            input.prevBalForPassbook = player.accountInfo.realChips + player.accountInfo.instantBonusAmount;
            let res: any = await addRealChipsOfUser(input, player);
            res.previousBal = player.accountInfo.realChips + player.accountInfo.instantBonusAmount
            return res;
        } else {
            let res: any = await addFreeChipsOfUser(input, player);
            return res;

        }
    }

};

async function addRealChipsOfUser(input: AddChipsPayload, player: Player) {
    // logger.info("addRealChipsOfUser--",input)
    async function passBookEntryLeave(input: AddChipsPayload, newAmount: number) {
        let query = { playerId: input.playerId };
        let data: any = {};
        data.time = Number(new Date());
        data.category = input.category;
        data.prevAmt = input.prevBalForPassbook;
        if (input.instantBonusAmount) {
            data.amount = input.chips + input.instantBonusAmount;
        } else {
            data.amount = input.chips;
        }
        data.newAmt = newAmount;
        if (input.tableName) {
            data.subCategory = "Leave";
            data.tableName = input.tableName;
        }
       
            return false;
    };

    //will intergrate Db later
    let result = await addRealChips({ playerId: input.playerId, instantBonusAmount: input.instantBonusAmount || 0 }, input.chips).catch(e => { console.log("add chips db error", e) });
    if (!!result) {
        let newBalance = result.accountInfo.realChips + result.accountInfo.instantBonusAmount;
        await passBookEntryLeave(input, newBalance);
        return ({ success: true, newBalance: newBalance });
    } else {
        return { success: false, tableId: input.tableId, info: "addChips failed!" };
    }
}

async function addFreeChipsOfUser(input: AddChipsPayload, player: Player) {
    // logger.info("addFreeChipsOfUser--",input)
//will add this later
    let result = await addFreeChips({ playerId: input.playerId }, input.chips).catch(e => { console.log("add chips db error", e) });
    if (!!result) {
        return ({ success: true, newBalance: result.accountInfo.playChips });
    } else {
        return { success: false, tableId: input.tableId, info: "addChips failed!" };
    }
}

export async function deductChips(input: DeductChipsPayload) {
    // logger.info("deductChips--",input)
    input.tableId = input.tableId || "";
    input.chips = Math.round(input.chips);
    let findUserError: any = null;
    //will integrate Db later
    let player: Player | void = await findUser({ playerId: input.playerId }).catch((e) => {
        findUserError = e;
    });
    if (!!findUserError) {
        findUserError.errorData = { success: false, info: "Unable to deduct chips, user not found. Player id" };
        return { success: false, info: "Unable to deduct chips, user not found. Player id" };;
    }
    if (!!player) {
        input.chips = input.isRealMoney ? player.accountInfo.realChips : player.accountInfo.playChips;
        if (input.isRealMoney) {
            // input.realChips = player.accountInfo.realChips;
            // input.instantBonusAmount = player.instantBonusAmount;
            let res: any = await deductRealChipsOfUser(input, player);
            res.playerData = player;
            return res;
        } else {
            let res: any = await deductFreeChipsOfUser(input, player);
            res.playerData = player;
            return res;
        }
    } else {
        return { success: false, tableId: input.tableId, info: "deduct Chips failed! Player." };
    }
}

async function deductRealChipsOfUser(input: DeductChipsPayload, player: Player) {
    if (player.accountInfo.realChips >= input.chips) {
        //deduct from real chips
        //will intergarte Db later
        let result = await deductRealChips({ playerId: input.playerId }, input.chips).catch(e => { });
        if (!result) {
            return { success: false, tableId: input.tableId, info: "Deduct chips failed!" }
        }
        let newAmtBal = result.accountInfo.realChips + result.accountInfo.instantBonusAmount;
        return ({ success: true, realChips: result.accountInfo.realChips, playChips: result.accountInfo.playChips, instantBonusAmount: 0 });
    } else {
        if (player.accountInfo.instantBonusAmount >= (input.chips - player.accountInfo.realChips)) {
            let bonusDeduct = input.chips - player.accountInfo.realChips;
            let result = await deductRealChips({ playerId: input.playerId }, input.chips, bonusDeduct).catch(e => { });
            if (!result) {
                return { success: false, tableId: input.tableId, info: "Deduct chips failed 2!" }
            }
            let newAmtBal = result.accountInfo.realChips + result.accountInfo.instantBonusAmount;
            return ({ success: true, realChips: result.accountInfo.realChips, playChips: result.accountInfo.playChips, instantBonusAmount: bonusDeduct });
        } else {
            return ({ success: false, tableId: input.tableId, info: "You have insufficient balance to play. Please, Buy Tusks" });
        }
    }
};

async function deductFreeChipsOfUser(input: DeductChipsPayload, player: Player) {
    // logger.info("deductFreeChipsOfUser--",input)
    if (input.chips <= player.accountInfo.playChips) {
        let result = await deductFreeChips({ playerId: input.playerId }, input.chips).catch(e => {

        });
        if (!result) {
            return { success: false, tableId: input.tableId, info: "Deduct chips failed!" }
        }
        return ({ success: true, realChips: result.accountInfo.realChips, playChips: result.accountInfo.playChips });
    } else {
        return ({ success: false, tableId: input.tableId, info: "You have insufficient balance to play. Please, Buy Tusks" });
    }

}

export async function getUserChips(params: { tableId?: string; chips?: number, playerId: string }) {
    // logger.info("getUserChips--",params)
    params.tableId = !!params.tableId ? params.tableId : "";
    params.chips = Math.floor(params.chips);
    let findUserError: any = null;
    let player: Player | void = await findUser({ playerId: params.playerId }).catch((e) => {
        findUserError = e;
    });
    if (!!findUserError) {
        return { success: false, info: "Unable to get user chips, user not found. Player id" };
    }
    if (!!player) {
        return ({ success: true, realChips: player.accountInfo.realChips, playChips: player.accountInfo.playChips });

    }
}