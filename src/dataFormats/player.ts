const uuid = require('uuid');
const shortid = require('shortid32');
shortid.characters('QWERTYUIOPASDFGHJKLZXCVBNM012345');
//#region Player
interface Players {
    info: BasicInfo;
    loginInfo: LoginInfo;
    activityInfo?: ActivityInfo;
    accountInfo: AccountInfo;
    playerId: string;
    ivoreeId: string;
    casinoTenentId:string;
    preferences: Preferences;
    additionalInfo: AdditionalInfo;
    
}

interface AdditionalInfo{
    game_text1?: string;
    game_text2?: string;
    game_text3?: string;
}

interface ActivityInfo {
    lastBetPlacedAt?: number;
    sessionStartedAt?: number;
}

interface BasicInfo {
    name: string;
    firstName: string;
    lastName: string;
    mobileNumber: string;
    avatar: any;
    address: Address;
    createdAt: string;
}
interface LoginInfo {
    callback_token: string;
    callback_url: string;
    isCallback_tokenRefereshed: boolean;
    lastLogin: string;
    game_timeout_min: number;
}

interface Address {
    pincode?: string;
    city: string;
    state: string;
    country: string;
    tier: string;
}

interface AccountInfo {
    realChips: number;
    playChips? : any;
    instantBonusAmount?: any;


    
}

interface LevelInfo {
    level: number;
    xp: number;
    loyalityRakeLevel: number;

}

interface Preferences {

    muteGameSound: boolean;
    muteGameMusic: boolean;
    felt_url:string;
    card_url:string;

}

interface Statistics {
    totalGamePlay: number
}

//?
interface ChipsManagement {
    deposit: number;
    withdrawl?: number;
    withdrawlPercent?: number;
    withdrawlCount?: number;
    withdrawlDate?: number;
};

interface RegisterPayload {
    userName?: string;
    emailId?: string;
    password?: string;
    phone?: string;
    playerID: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    dateOfBirth?: string;
    gender?: string;
    avatar_url?: string;
    address?: any;
    isBot?: boolean;
    casinoTenentId:string;


    ipV4Address?: string;
    ipV6Address?: string;
    deviceType?: string;
    loginMode?: string;
    referralCode?: string;
    universeId: string;


    pl_location_state?: string;
    pl_location_country?: string;
    tier?: string;
    tusks_bal?: number;
    discr_tusks_bal?: number;
    felt_url?: string;
    card_url?: string;
    game_text1?: string;
    game_text2?: string;
    game_text3?: string;

    callback_token?: string;
    callback_url?: string;
    game_timeout_min?: number
}
//#endregion
export class Player implements Players {
    _id? : any;
    info: BasicInfo;
    loginInfo: LoginInfo;
    activityInfo?: ActivityInfo;
    accountInfo: AccountInfo;
    playerId: string;
    ivoreeId: string;
    casinoTenentId:string;
    preferences: Preferences; 
    additionalInfo: AdditionalInfo;
    statistics?: any;
    playChips?: any;

    public constructor(x: any, y: boolean);

    constructor(data: RegisterPayload, justNumber: boolean = false) {
        if (!!justNumber) {
            this.createDataForUser(data);
        } else {
            this.createDataForUser(data);
        }
        this.temp();
    }



    createDataForUser(userData: RegisterPayload) {
        this.info = {
            name: !!userData && userData.userName ? userData.userName : "",
            firstName: !!userData && userData.firstName ? userData.firstName : "",
            lastName: !!userData && userData.lastName ? userData.lastName : "",
            mobileNumber: !!userData && userData.phone ? userData.phone : "",
            
            avatar: !!userData && userData.avatar_url ? userData.avatar_url : "",
           
            address: {
                city: "",
                state:!!userData && userData.pl_location_state ? userData.pl_location_state: "",
                country: !!userData && userData.pl_location_country ? userData.pl_location_country:"",
                tier: !!userData && userData.tier ? userData.tier:""
            },
            createdAt: new Date().toISOString()
        };

        this.loginInfo = {
            callback_token: !!userData && userData.callback_token ? userData.callback_token : "",
            callback_url: !!userData && userData.callback_url ? userData.callback_url : "",
            isCallback_tokenRefereshed: true,
            lastLogin: new Date().toISOString(),
            game_timeout_min: !!userData && userData.game_timeout_min ? userData.game_timeout_min : 25

        }

        this.accountInfo = {
            realChips: !!userData && userData.tusks_bal ? userData.tusks_bal : 0,
            
        }


       
        this.playerId = userData.playerID;
        this.ivoreeId = userData.playerID;
        this.casinoTenentId = userData.casinoTenentId || ""

        this.preferences = {
            muteGameMusic: false,
            muteGameSound: false,
            felt_url: !!userData && userData.card_url ? userData.card_url : "",
            card_url: !!userData && userData.card_url ? userData.card_url : ""
        }

        this.additionalInfo={
            game_text1: userData.game_text1 || "",
            game_text2: userData.game_text2 || "",
            game_text3: userData.game_text3 || ""
        }
    };

    temp() {
        this.accountInfo.realChips = 10000;
    }

}

